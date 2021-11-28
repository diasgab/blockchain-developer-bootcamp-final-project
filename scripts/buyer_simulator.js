
const Buyer = artifacts.require('Buyer')
const UNI_ADDRESS = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'

module.exports = async callback => {
  try {

    const buyer = await Buyer.deployed();
    const accounts = await web3.eth.getAccounts();

    console.log("Let's change the price of UNI token using the Buyer contract");

    await buyer.deposit({from: accounts[2], value: 90000000000000000000})
    await buyer.deposit({from: accounts[3], value: 90000000000000000000})
    await buyer.deposit({from: accounts[4], value: 90000000000000000000})
    await buyer.deposit({from: accounts[5], value: 90000000000000000000})
    await buyer.deposit({from: accounts[6], value: 90000000000000000000})

    await buyer.swapETHForTokens(UNI_ADDRESS, web3.utils.toWei('450', 'ether'))

    console.log("Bought 450 ETH of UNI Token");

    callback()
  } catch (err) {
    console.log("Error: ", err);
    callback()
  }
}

