/**
 * @module
 * @author iAmMichaelConnor
 * @desc Run from within nightfall/zkp/code
 */

// eslint-disable-next-line import/extensions
const { compile, setup, exportVerifier } = require('@eyblockchain/zokrates.js');
const util = require('util');
const os = require('os');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const readdirAsync = util.promisify(fs.readdir);

/**
 * Returns an array of all imported files in dataLines.
 * @param {String[]} dataLines - Array of lines that make up a .code file.
 * @returns {String[]} - Array of imported files in dataLines.
 */
function getImportFiles(dataLines) {
  const cpDataLines = [...dataLines];
  return cpDataLines.reduce((accArr, line) => {
    // parses each line of the .code file for a line of the form:
    // import "./aux-adder.code" as ADD
    //  and extracts "./aux-adder.code"
    // ZoKrates' own packages will be ignored, as they are of the form:
    // import "LIBSNARK/sha256compression"
    //  which doesn't include ".code", and so are ignored.
    line.replace(/((import ")+(.+\.+code+)+("+))+?/g, (m1, m2, ii, c) => {
      if (c !== undefined) {
        accArr.push(c);
      }
    });
    return accArr;
  }, []);
}

/**
 * Ensures that any imported dependencies in code files are present.
 * @param {String} codeFileDirectory - Directory in which code file resides (i.e., /gm17/ft-burn)
 * @param {String} codeFile - Name of code file (i.e., ft-burn)
 * @throws {Error} - If a dependent code file is not found
 */
async function checkForImportFiles(codeFileDirectory, codeFile) {
  const dataLines = fs
    .readFileSync(`${codeFileDirectory}/${codeFile}`)
    .toString('UTF8')
    .split(os.EOL);

  // Assumes that any dependencies will exist in the /code/gm17 directory.
  const codeFileParentPath = path.join(codeFileDirectory, '../../');

  let importFiles = [];
  importFiles = getImportFiles(dataLines);
  if (!(importFiles === undefined || importFiles.length === 0)) {
    // array is nonempty
    for (let j = 0; j < importFiles.length; j += 1) {
      const file = importFiles[j];
      if (!fs.existsSync(codeFileParentPath + file)) {
        // throw new Error(`Imported file in ${codeFile}: ${file} not found in ${codeFileParentPath}`);
      }
    }
  }
}

/**
 * Currently, this function will catch "missing" imports, but only logs out on missing files.
 * @param {string} codeDirectory - Directory that contains the .code file (e.g., '/code/gm17/ft-burn')
 */
async function filingChecks(codeDirectory) {
  const files = await readdirAsync(codeDirectory);

  // Looking for the .code file, e.g., ft-burn.out
  let codeFileName;
  let codeFileExt;
  for (let j = 0; j < files.length; j += 1) {
    codeFileName = files[j].substring(0, files[j].lastIndexOf('.'));
    codeFileExt = files[j].substring(files[j].lastIndexOf('.') + 1, files[j].length);

    // Output directory
    // Looking for a .code file, but not out.code
    if (codeFileExt === 'code' && codeFileName !== 'out') {
      break;
    }
  }

  await checkForImportFiles(`${codeDirectory}`, `${codeFileName}.${codeFileExt}`);
}

/**
 * @param {string} solFilePath
 */
function keyExtractor(solFilePath) {
  const solData = fs
    .readFileSync(solFilePath)
    .toString('UTF8')
    .split(os.EOL);
  const jsonTxt = [];
  jsonTxt.push('{');
  solData.forEach(el => {
    let m;
    // eslint-disable-next-line no-cond-assign
    if ((m = el.trim().match(/^vk\..*/)) && !m[0].includes('new')) {
      jsonTxt.push(
        m[0]
          .replace(/Pairing\.G.Point/, '')
          .replace(/\);/, ']')
          .replace(/\(/, '[')
          .replace(/(0x[0-9a-f]*?)([,\]])/g, '"$1"$2')
          .replace(/^(vk\..*?) = /, '"$1": ')
          .replace(/$/, ',')
          .replace(/vk\./, '')
          .replace(/"IC\[0\]":/, '"IC": [')
          .replace(/"IC\[\d*?\]":/, '')
          .replace(/"query\[0\]":/, '"query": [') // added for GM17
          .replace(/"query\[\d*?\]":/, '') // added for GM17
          .replace(/uint256/g, '') // added for ZoKrates 0.4.10
          .replace(/\(/g, '"') // added for ZoKrates 0.4.10
          .replace(/\)/g, '"') // added for ZoKrates 0.4.10
          .replace('"h"', '"H"')
          .replace('g_alpha', 'Galpha')
          .replace('h_beta', 'Hbeta')
          .replace('g_gamma', 'Ggamma')
          .replace('h_gamma', 'Hgamma'),
      );
    }
  });
  const l = jsonTxt.length - 1;
  jsonTxt[l] = `${jsonTxt[l].substring(0, jsonTxt[l].length - 1)}]`; // remove last comma
  jsonTxt.push('}');
  logger.debug(jsonTxt.join('\n'));
  return jsonTxt.join('\n');
}

/**
 * Given a directory that contains a .code file (ignoring any out.code files), calls Zokrates compile,
 * setup and export verifier and outputs all the necessary Zokrates files in that same directory.
 * @param {String} directoryPath
 * @param {Boolean} suppress - Flag for logging out zokrates output or not.
 */
async function generateZokratesFiles(directoryPath) {
  // Check to see if imports are present.
  await filingChecks(directoryPath);

  const files = await readdirAsync(directoryPath);

  logger.info(`Setup for directory ${directoryPath}`);

  const directoryWithSlash = directoryPath.endsWith('/') ? directoryPath : `${directoryPath}/`;

  let codeFile;
  // Look for a .code file that's not out.code. That's the file we're compiling.
  for (let j = 0; j < files.length; j += 1) {
    if (files[j].endsWith('.code') && files[j] !== 'out.code') {
      codeFile = files[j];
      break;
    }
  }

  logger.info('Compiling', `${directoryWithSlash}${codeFile}`);

  // Generate out.code and out in the same directory.
  const compileOutput = await compile(
    `${directoryWithSlash}${codeFile}`,
    directoryWithSlash,
    'out',
    {
      verbose: true,
    },
  );
  logger.debug('Compile output:', compileOutput);
  logger.info('Finished compiling at', directoryPath);

  logger.info('Running setup on', directoryPath);
  // Generate verification.key and proving.key
  const setupOutput = await setup(
    `${directoryWithSlash}out`,
    directoryWithSlash,
    'gm17',
    'verification.key',
    'proving.key',
    { verbose: true },
  );
  logger.debug('Setup output:', setupOutput);
  logger.info('Finished setup at', directoryPath);

  logger.info('Running export-verifier at', directoryPath);
  const exportVerifierOutput = await exportVerifier(
    `${directoryWithSlash}/verification.key`,
    directoryWithSlash,
    'verifier.sol',
    'gm17',
    { verbose: true },
  );
  logger.debug('Export-verifier output:', exportVerifierOutput);
  logger.info('Finished export-verifier at', directoryPath);

  logger.verbose(`Extracting key from ${directoryWithSlash}verifier.sol`);
  const vkJson = await keyExtractor(`${directoryWithSlash}verifier.sol`, true);

  logger.info(`Writing ${directoryWithSlash}${codeFile.split('.')[0]}-vk.json`);
  // Create a JSON with the file name but without .code
  fs.writeFileSync(`${directoryWithSlash}${codeFile.split('.')[0]}-vk.json`, vkJson, err => {
    if (err) {
      logger.error(err);
    }
  });
  logger.info(directoryPath, 'is done setting up.');
}

module.exports = generateZokratesFiles;
