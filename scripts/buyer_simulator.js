
module.exports = async (callback) => {

  try {

    const accounts = await web3.eth.getAccounts();
    const account = accounts[0];
    const recipient = accounts[0];

    // transfer a big amount to the first account
    let totalAmountToBuy = 0
    for (let i = 4; i < accounts.length; i++) {
      console.log("Sending 90 ether to buyer account: " + account);
      await web3.eth.sendTransaction({
        from: accounts[i],
        to: account,
        value: web3.utils.toWei("90", "ether")
      })

      totalAmountToBuy += 90;
    }

    const addresses = {
      WETH: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
      UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    };

    const jsonAbi = {
      "abi": [
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amountIn",
              "type": "uint256"
            },
            {
              "internalType": "address[]",
              "name": "path",
              "type": "address[]"
            }
          ],
          "name": "getAmountsOut",
          "outputs": [
            {
              "internalType": "uint256[]",
              "name": "amounts",
              "type": "uint256[]"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amountOutMin",
              "type": "uint256"
            },
            {
              "internalType": "address[]",
              "name": "path",
              "type": "address[]"
            },
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "deadline",
              "type": "uint256"
            }
          ],
          "name": "swapExactETHForTokens",
          "outputs": [
            {
              "internalType": "uint256[]",
              "name": "amounts",
              "type": "uint256[]"
            }
          ],
          "stateMutability": "payable",
          "type": "function"
        },
      ],
    };

    web3.eth.defaultAccount = account;
    const router = new web3.eth.Contract(
      jsonAbi.abi,
      addresses.router
    );

    console.log(
      "Let's change the price of UNI token by buying a huge quantity"
    );

    let tokenIn = addresses.WETH;
    let tokenOut = addresses.UNI;

    const amountIn = web3.utils.toWei(String(totalAmountToBuy), "ether");

    const amounts = await router.methods.getAmountsOut(amountIn, [tokenIn, tokenOut]).call();
    const amountOutMin = web3.utils.toWei(web3.utils.fromWei(amounts[1]), "ether");

    console.log(`
      Buying new token
      =================
      tokenIn: ${amountIn.toString()} ${tokenIn} (WETH)
      tokenOut: ${amountOutMin.toString()} ${tokenOut}
    `);

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expiryDate = nowInSeconds + 900;

    const tx = await router.methods.swapExactETHForTokens(
        amountOutMin,
        [tokenIn, tokenOut],
        recipient,
        expiryDate
      ).send({
        from: account,
        gasLimit: 1000000,
        gasPrice: web3.utils.toWei('10', 'Gwei'),
        value: amountIn
      });

      console.log("Transaction made");
      console.log(tx)

    callback();
  } catch (err) {
    console.log("Error: ", err);
    callback();
  }
};
