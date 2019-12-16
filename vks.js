/**
@module vk-controller.js
@author iAmMichaelConnor
@desc this acts as a layer of logic between the restapi.js, which lands the
rest api calls, and the heavy-lifitng token-zkp.js and zokrates.js.  It exists so that the amount of logic in restapi.js is absolutely minimised.
*/

import contract from 'truffle-contract';
import jsonfile from 'jsonfile';
import config from 'config';
import utils from './utils';
import Web3 from './provider';
import logger from './logger';

/**
Loads a verification key to the Verifier Registry
 * @param {String} vkJsonFile - Path to vk file in JSON form
 * @param {Object} blockchainOptions
 * @param {Object} blockchainOptions.verifierJson - Compiled JSON of verifier contract
 * @param {String} blockchainOptions.verifierAddress - address of deployed verifier contract
 * @param {Object} blockchainOptions.verifierRegistryJson - Compiled JSON of verifier contract
 * @param {String} blockchainOptions.verifierRegistryAddress - address of deployed verifier contract
 * @param {String} blockchainOptions.account - Account that will send the transactions
*/
async function loadVk(vkJsonFile, blockchainOptions) {
  const {
    verifierJson,
    verifierAddress,
    verifierRegistryJson,
    verifierRegistryAddress,
    account,
  } = blockchainOptions;

  logger.verbose(`Loading VK for ${vkJsonFile}`);

  const verifier = contract(verifierJson);
  verifier.setProvider(Web3.connect());
  const verifierInstance = await verifier.at(verifierAddress);

  const verifierRegistry = contract(verifierRegistryJson);
  verifierRegistry.setProvider(Web3.connect());
  const verifierRegistryInstance = await verifierRegistry.at(verifierRegistryAddress);

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
  logger.debug('Registering verifying key');
  const txReceipt = await verifierRegistryInstance.registerVk(vk, [verifierInstance.address], {
    from: account,
    gas: 6500000,
    gasPrice: config.GASPRICE,
  });

  // eslint-disable-next-line no-underscore-dangle
  const vkId = txReceipt.logs[0].args._vkId;

  return vkId;
}

module.exports = {
  loadVk,
};
