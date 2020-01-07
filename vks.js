/**
@module vk-controller.js
@author iAmMichaelConnor
@desc this acts as a layer of logic between the restapi.js, which lands the
rest api calls, and the heavy-lifitng token-zkp.js and zokrates.js.  It exists so that the amount of logic in restapi.js is absolutely minimised.
*/

const contract = require('truffle-contract');
const jsonfile = require('jsonfile');
const config = require('./config');
const utils = require('./utils');
const Web3 = require('./provider');
const logger = require('./logger');

/**
Loads a verification key to the Verifier Registry
 * @param {string} vkIdentifier - A 'key' against which the Shield Contract will store the vk. 'vkIdentifier's could (for example) be strings of the form 'mint', 'transfer', 'burn'; or integers of the form 0, 1, 2 (or some other unique identifier).
 * @param {String} vkJsonFile - Path to vk file in JSON form
 * @param {Object} blockchainOptions
 * @param {Object} blockchainOptions.vkRegistryJson - Compiled JSON of verifier contract
 * @param {String} blockchainOptions.vkRegistryAddress - address of deployed verifier contract
 * @param {String} blockchainOptions.account - Account that will send the transactions
*/
async function loadVk(vkIdentifier, vkJsonFile, blockchainOptions) {
  const { vkRegistryJson, vkRegistryAddress, account } = blockchainOptions;

  logger.verbose(`Loading VK for ${vkJsonFile}`);

  const vkRegistry = contract(vkRegistryJson);
  vkRegistry.setProvider(Web3.connect());
  const vkRegistryInstance = await vkRegistry.at(vkRegistryAddress);

  // Get VKs from the /code/gm17 directory and convert them into Solidity uints.
  let vk = await new Promise((resolve, reject) => {
    jsonfile.readFile(vkJsonFile, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
  vk = Object.values(vk);
  vk = utils.flattenDeep(vk);
  vk = vk.map(el => utils.hexToDec(el));

  // upload the vk to the smart contract
  logger.debug('Registering verification key');
  await vkRegistryInstance.registerVerificationKey(vk, vkIdentifier, {
    from: account,
    gas: 6500000,
    gasPrice: config.GASPRICE,
  });
}

module.exports = {
  loadVk,
};
