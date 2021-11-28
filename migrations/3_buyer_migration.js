const Buyer = artifacts.require("Buyer");

module.exports = function (deployer) {
  deployer.deploy(Buyer);
};
