const Balancer = artifacts.require("Balancer");
const fs = require('fs');

module.exports = async function (deployer) {
  await deployer.deploy(
    Balancer,
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap rinkeby router
  );

  let config = {
    networks: Balancer.networks
  }

  // prepare these files for the client app
  fs.writeFileSync(__dirname + '/../client/contracts/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
  fs.writeFileSync(__dirname + '/../client/contracts/Balancer.json', JSON.stringify(Balancer.abi), 'utf-8');
}