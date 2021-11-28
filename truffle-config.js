
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
