import Web3 from 'web3';
import logger from './logger';

module.exports = {
  connection() {
    return this.web3;
  },

  /**
   * Connects to web3 and then sets proper handlers for events
   * @param blockchainUrl - URL for the blockchain provider to connect to, in the format of ws://ganache:8545
   */
  connect(blockchainUrl) {
    if (this.web3) return this.web3.currentProvider;

    logger.info('Blockchain Connecting ...');
    const provider = new Web3.providers.WebsocketProvider(blockchainUrl);

    provider.on('error', logger.error);
    provider.on('connect', () => logger.info('Blockchain Connected ...'));
    provider.on('end', logger.error);

    this.web3 = new Web3(provider);

    return provider;
  },

  /**
   * Checks the status of connection
   *
   * @return {Boolean} - Resolves to true or false
   */
  isConnected() {
    if (this.web3) {
      return this.web3.eth.net.isListening();
    }
    return false;
  },
};
