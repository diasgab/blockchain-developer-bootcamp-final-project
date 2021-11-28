const Balancer = artifacts.require("Balancer");

module.exports = async (callback) => {
  try {
    const balancer = await Balancer.deployed();
    const accounts = await web3.eth.getAccounts();
    const contractOwner = accounts[0];

    // tokens
    const UNI_token = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
    const BAT_token = "0xbF7A7169562078c96f0eC1A8aFD6aE50f12e5A99";

    const tokens = [UNI_token, BAT_token];

    console.log("Let's add some default tokens");

    for (let i = 0; i < tokens.length; i++) {
      // TODO: check it works!
      await balancer.addAllowedAsset(tokens[i], { from: contractOwner });
    }

    console.log("Tokens added");

    callback();
  } catch (err) {
    console.log("Error: ", err);
    callback();
  }
};
