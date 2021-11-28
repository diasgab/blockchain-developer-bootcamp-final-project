const dotenv = require("dotenv");
dotenv.config();

const HDWalletProvider = require('@truffle/hdwallet-provider');
const mnemonic = process.env.RINKEBY_MNEMONIC;

module.exports = {
  networks: {
     development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
    },

    // This is the rinkeby fork running in Ganache
    rinkebylocal: {
      host: '127.0.0.1',
      port: 8545,
      network_id: 4,
      skipDryRun: true,
      gas: 6000000
    },

    rinkeby: {
      provider: () => new HDWalletProvider(mnemonic, `https://rinkeby.infura.io/v3/${process.env.RINKEBY_INFURA_PROJECT_ID}`),
      network_id: 4,       // rinkeby's id
      gas: 5500000,        // rinkeby has a lower block limit than mainnet
      skipDryRun: true
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
       version: "0.8.6",    // Fetch exact version from solc-bin (default: truffle's version)
    }
  },
};
