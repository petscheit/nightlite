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
 * @param {string} vkDescription - Description of the 'functionality' that the vk represents. This string is interpreted by the smart contract which stores the vk's (a.k.a. the vkRegistry).
 * @param {String} vkJsonFile - Path to vk file in JSON form
 * @param {Object} blockchainOptions
 * @param {Object} blockchainOptions.shieldJson - Compiled JSON of relevant Shield (i.e., NFTokenShield or FTokenShield)
 * @param {String} blockchainOptions.shieldAddress - address of relevant Shield contract (i.e., NFTokenShield or FTokenShield)
 * @param {String} blockchainOptions.account - Account that will send the transactions
*/
async function loadVk(vkDescription, vkJsonFile, blockchainOptions) {
  const { shieldJson, shieldAddress, account } = blockchainOptions;

  logger.verbose(`Loading VK for ${vkJsonFile}`);

  const vkRegistry = contract(shieldJson);
  vkRegistry.setProvider(Web3.connect());
  const vkRegistryInstance = await vkRegistry.at(shieldAddress);

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
  await vkRegistryInstance.registerVerificationKey(vk, vkDescription, {
    from: account,
    gas: 6500000,
    gasPrice: config.GASPRICE,
  });
}

module.exports = {
  loadVk,
};
