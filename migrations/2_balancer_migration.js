const Balancer = artifacts.require("Balancer");
const fs = require('fs');

module.exports = async function (deployer) {
  await deployer.deploy(
    Balancer,
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap rinkeby router
  );

  let config = {
    balancerAddress: Balancer.address
  }
  fs.writeFileSync(__dirname + '/../client/src/config.json',JSON.stringify(config, null, '\t'), 'utf-8');

  // NOTE: the address in this file is updated later, that's the reason why we need to copy the address separate
  fs.copyFile(__dirname + '/../build/contracts/Balancer.json', __dirname + '/../client/contracts/Balancer.json', function (err) {
    if (err) throw err;
  });
}