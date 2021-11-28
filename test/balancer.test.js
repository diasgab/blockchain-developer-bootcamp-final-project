var Balancer = artifacts.require("./Balancer.sol");

contract("Balancer", function (accounts) {
  const [contractOwner, userAccount] = accounts;
  const deposit = web3.utils.toWei("0.2", "ether");

  // address for UNI token in rinkeby network
  const UNI_token = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
  // address for BAT token in rinkeby network
  const BAT_token = "0xbF7A7169562078c96f0eC1A8aFD6aE50f12e5A99";

  const UNISWAP_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

  beforeEach(async () => {
    instance = await Balancer.new(UNISWAP_ROUTER);
  });

  it("is owned by owner using openzeppelin Ownable", async () => {
    assert.strictEqual(
      await instance.owner(),
      contractOwner,
      "owner is not correct"
    );
  });

  it("should log a deposit event when a deposit is made", async () => {
    const result = await instance.deposit({
      from: userAccount,
      value: deposit,
    });
    const expectedEventResult = {
      accountAddress: userAccount,
      amount: deposit,
    };

    const logAccountAddress = result.logs[0].args.accountAddress;
    const logDepositAmount = result.logs[0].args.amount;

    assert.equal(
      expectedEventResult.accountAddress,
      logAccountAddress,
      "LogDepositMade event: accountAddress property not emitted, check deposit method"
    );

    assert.equal(
      expectedEventResult.amount,
      logDepositAmount,
      "LogDepositMade event: amount property not emitted, check deposit method"
    );
  });

  it("should allow the contract owner to add a new asset", async () => {
    await instance.addAllowedAsset(UNI_token, { from: contractOwner });
    const allowedAssetsList = await instance.allowedAssetsList();

    assert.equal(
      1,
      allowedAssetsList.length,
      "Allowed assets must contain 1 element"
    );
    assert.equal(
      UNI_token,
      allowedAssetsList[0],
      `Asset ${UNI_token} not added properly`
    );
  });

  it("should emit an event when a new allowed asset is added", async () => {
    const result = await instance.addAllowedAsset(UNI_token, {
      from: contractOwner,
    });
    const logAssetAddress = result.logs[0].args.assetAddress;

    assert.equal(
      UNI_token,
      logAssetAddress,
      "LogAssetAdded event: logAssetAddress property not emitted, check addAllowedAsset method"
    );
  });

  it("TODO: should allow the contract owner to add a new asset", async () => {
    // TODO: test a non owner cannot do this!
  });

  it("should deposit correct amount", async () => {
    await instance.deposit({ from: userAccount, value: deposit });
    const balance = await instance.balances(userAccount);

    assert.equal(
      deposit.toString(),
      balance,
      "deposit amount incorrect, check deposit method"
    );
  });

  it("should withdraw correct amount", async () => {
    const depositValue = web3.utils.toWei("0.2", "ether");
    const withdrawValue = web3.utils.toWei("0.08", "ether");

    await instance.deposit({ from: userAccount, value: depositValue });
    await instance.withdraw(withdrawValue, { from: userAccount });
    const balance = await instance.balances(userAccount);

    assert.equal(
      web3.utils.toWei("0.12", "ether").toString(),
      balance,
      "withdraw amount incorrect, check withdraw method"
    );
  });

  it("should allow a user to create a portfolio", async () => {
    await instance.addAllowedAsset(UNI_token, { from: contractOwner });
    await instance.addAllowedAsset(BAT_token, { from: contractOwner });

    await instance.deposit({ from: userAccount, value: deposit });

    let assets = [UNI_token, BAT_token];
    let percentages = [60, 40];

    const portfolio = await instance.createPortfolio(assets, percentages, { from: userAccount });

    const logAssets = portfolio.logs[0].args.assets;
    const logPercentages = portfolio.logs[0].args.percentages;

    assert.equal(UNI_token, logAssets[0], "wrong asset assignment for UNI");
    assert.equal(BAT_token, logAssets[1], "wrong asset assignment for BAT");

    assert.equal(60, logPercentages[0], "wrong percentage assignment for UNI");
    assert.equal(40, logPercentages[1], "wrong percentage assignment for BAT");

    // finally check the portfolio is sealed
    const sealedPortfolio = await instance.isPortfolioSealed(userAccount);
    assert.equal(true, sealedPortfolio, "portfolio should be sealed");
  });

  it("TODO: should check the the allowed assets to be added to a portfolio", async () => {
    assert.isTrue(true);
  });

  it("TODO: should emit an event when a user portfolio is sealed", async () => {
    assert.isTrue(true);
  });

  /*it("should allow an account to run the initial portfolio distribution", async () => {
    await instance.addAllowedAsset(UNI_token, { from: contractOwner });
    await instance.addAllowedAsset(BAT_token, { from: contractOwner });

    await instance.deposit({ from: userAccount, value: deposit });
    await instance.addPortfolioAsset(UNI_token, 60, { from: userAccount });
    await instance.addPortfolioAsset(BAT_token, 40, { from: userAccount });
    await instance.sealPortfolio({ from: userAccount });

    await instance.runInitialPortfolioDistribution({ from: userAccount });

    const balance = await instance.balances(userAccount);

    assert.equal(0, balance, "the user balance should be 0");

    const UNIBalance = await instance.assetBalances(userAccount, UNI_token);
    const BATBalance = await instance.assetBalances(userAccount, BAT_token);

    assert.equal(200, UNIBalance, "UNI token balance incorrect");

    assert.equal(200, BATBalance, "BAT token balance incorrect");
  });

  it("should allow an account to empty a portfolio", async () => {
    await instance.addAllowedAsset(UNI_token, { from: contractOwner });
    await instance.addAllowedAsset(BAT_token, { from: contractOwner });

    await instance.deposit({ from: userAccount, value: deposit });
    await instance.addPortfolioAsset(UNI_token, 60, { from: userAccount });
    await instance.addPortfolioAsset(BAT_token, 40, { from: userAccount });
    await instance.sealPortfolio({ from: userAccount });

    await instance.runInitialPortfolioDistribution({ from: userAccount });

    await instance.emptyPortfolio({ from: userAccount });

    const balance = await instance.balances(userAccount);

    console.log("Balance is:", balance.toString());
    assert.equal(600, balance, "the user balance should be 400");
  });*/
});
