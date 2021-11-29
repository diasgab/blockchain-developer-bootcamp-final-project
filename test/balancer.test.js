var Balancer = artifacts.require("./Balancer.sol");

const getErrorObj = (obj = {}) => {
  const txHash = Object.keys(obj)[0];
  return obj[txHash];
};

// addresses in rinkeby network
const UNISWAP_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const UNI_token = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
const BAT_token = "0xbF7A7169562078c96f0eC1A8aFD6aE50f12e5A99";
const WETH_token = "0xc778417E063141139Fce010982780140Aa0cD5Ab";
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

const addFirstAllowedAsset = async (instance, tx = {}) => {
  await instance.addAllowedAsset(UNI_token, tx);
};

const addSecondAllowedAsset = async (instance, tx = {}) => {
  await instance.addAllowedAsset(BAT_token, tx);
};

const createValidPortfolio = async (instance, userAccount, deposit) => {
  await instance.deposit({ from: userAccount, value: deposit });
  let assets = [UNI_token, BAT_token];
  let percentages = [60, 40];
  await instance.createPortfolio(assets, percentages, { from: userAccount });
};

// error codes
const ERR_NOT_OWNER = "Ownable: caller is not the owner";
const ERR_NOT_ENOUGH_FUNDS = "Not enough funds";
const ERR_NOT_ENOUGH_BALANCE = "Not enough balance";
const ERR_PORTFOLIO_ASSETS_LENGTH_MISMATCH = "Missing data for assets and percentages";
const ERR_ASSET_NOT_ALLOWED = "Asset not allowed in portfolio";
const ERR_PORTFOLIO_ASSETS_LENGTH_MIN = "The minimum amount of assets is 2";
const ERR_PORTFOLIO_ASSETS_LENGTH_MAX = "Max amount of assets allowed";
const ERR_PORTFOLIO_ASSET_MIN_PERCENTAGE = "The percentage range per asset is 1 to 99";
const ERR_PORTFOLIO_ASSET_MAX_PERCENTAGE = "The percentage range per asset is 1 to 99";
const ERR_PORTFOLIO_SUM_PERCENTAGE_NOT_100 = "The sum of all the percentages must equal 100";
const ERR_PORTFOLIO_NOT_SEALED = "Portfolio must be sealed";
const ERR_NO_PORTFOLIO = "There is no portfolio";
const ERR_PORTFOLIO_MUST_BE_ACTIVE = "Portfolio must be active";

// portfolio status map
const Status = {
  EMPTY: 0,
  SEALED: 1,
  INITIALIZED: 2,
  RUNNING: 3,
};

contract("Balancer", function (accounts) {
  const [contractOwner, userAccount] = accounts;
  const deposit = web3.utils.toWei("1", "ether");

  beforeEach(async () => {
    instance = await Balancer.new(UNISWAP_ROUTER);
    await addFirstAllowedAsset(instance, { from: contractOwner });
    await addSecondAllowedAsset(instance, { from: contractOwner });
  });

  it("is owned by owner using openzeppelin Ownable", async () => {
    assert.strictEqual(
      await instance.owner(),
      contractOwner,
      "owner is not correct"
    );
  });

  describe("addAllowedAsset()", () => {
    it("should allow the owner to add an allowed asset", async () => {
      await instance.addAllowedAsset(WETH_token, { from: contractOwner });
      const allowedAssetsList = await instance.allowedAssetsList();

      // because we have already added 2 assets, this would be the third one
      assert.equal(
        allowedAssetsList.length,
        3,
        "Allowed assets should be 3"
      );
      assert.equal(
        allowedAssetsList[2],
        WETH_token,
        `Asset ${WETH_token} not added properly`
      );
    });

    it("should fail to add an allowed assets if not the owner", async () => {
      try {
        await instance.addAllowedAsset(WETH_token, { from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_NOT_OWNER);
      }
    });

    it("should emit an event when a new allowed token is added", async () => {
      const result = await instance.addAllowedAsset(WETH_token, {
        from: contractOwner,
      });

      const logAssetAddress = result.logs[0].args.assetAddress;

      assert.equal(
        logAssetAddress,
        WETH_token,
        "wrong property assetAddress in addAllowedAsset event"
      );
    });
  });

  describe("deposit()", () => {
    it("should deposit correct amount", async () => {
      await instance.deposit({ from: userAccount, value: deposit });
      const balance = await instance.balances(userAccount);

      assert.equal(
        balance,
        deposit.toString(),
        "deposit amount incorrect"
      );
    });

    it("should emit an event when a deposit is made", async () => {
      const result = await instance.deposit({ from: userAccount, value: deposit });

      assert.equal(
        result.logs[0].args.accountAddress,
        userAccount,
        "wrong property accountAddress in deposit event"
      );

      assert.equal(
        result.logs[0].args.amount,
        deposit,
        "wrong property amount in deposit event"
      );
    });
  });

  describe("withdraw()", () => {
    it("should withdraw correct amount", async () => {
      const depositValue = web3.utils.toWei("0.2", "ether");
      const withdrawValue = web3.utils.toWei("0.08", "ether");

      await instance.deposit({ from: userAccount, value: depositValue });
      await instance.withdraw(withdrawValue, { from: userAccount });
      const balance = await instance.balances(userAccount);

      assert.equal(
        balance,
        web3.utils.toWei("0.12", "ether").toString(),
        "withdraw amount incorrect"
      );
    });

    it("should fail to withdraw if there are no funds", async () => {
      const depositValue = web3.utils.toWei("0.1", "ether");
      const withdrawValue = web3.utils.toWei("1", "ether");

      await instance.deposit({ from: userAccount, value: depositValue });

      try {
        await instance.withdraw(withdrawValue, { from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_NOT_ENOUGH_FUNDS);
      }
    });

    it("should emit an event when a withdraw is made", async () => {
      const depositValue = web3.utils.toWei("1", "ether");
      const withdrawValue = web3.utils.toWei("0.2", "ether");
      await instance.deposit({ from: userAccount, value: depositValue });
      const result = await instance.withdraw(withdrawValue, { from: userAccount });

      assert.equal(
        result.logs[0].args.accountAddress,
        userAccount,
        "wrong property accountAddress in withdraw event"
      );

      assert.equal(
        result.logs[0].args.withdrawAmount,
        withdrawValue,
        "wrong property withdrawAmount in withdraw event"
      );

      assert.equal(
        result.logs[0].args.newBalance,
        web3.utils.toWei("0.8", "ether"),
        "wrong property newBalance in withdraw event"
      );
    });
  });

  describe("createPortfolio()", () => {
    it("should allow an account with funds to create a portfolio", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      const portfolioStatus = await instance.getPortfolioStatus(userAccount);

      assert.equal(portfolioStatus.toNumber(), Status.SEALED, "portfolio should be sealed");
    });

    it("should fail to create a portfolio if the account has no funds", async () => {
      let assets = [UNI_token, BAT_token];
      let percentages = [60, 40];

      try {
        await instance.createPortfolio(assets, percentages, { from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_NOT_ENOUGH_FUNDS);
      }
    });

    it("should fail to create portfolio if assets and percentages length is not equal", async () => {
      await instance.deposit({ from: userAccount, value: deposit });
      let assets = [UNI_token, BAT_token];
      let percentages = [60];

      try {
        await instance.createPortfolio(assets, percentages, { from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_PORTFOLIO_ASSETS_LENGTH_MISMATCH);
      }
    });

    it("should fail to create portfolio if amount of assets is grater than 10", async () => {
      await instance.deposit({ from: userAccount, value: deposit });

      let assets = [];
      let percentages = [];
      for (let i = 0; i < 11; i++) {
        assets.push(ADDRESS_ZERO);
        percentages.push(10);
      }

      try {
        await instance.createPortfolio(assets, percentages, { from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_PORTFOLIO_ASSETS_LENGTH_MAX);
      }
    });

    it("TODO: should fail to create portfolio if assets are repeated", async () => {

    });

    it("should fail to create portfolio if any asset is not allowed", async () => {
      await instance.deposit({ from: userAccount, value: deposit });
      let assets = [UNI_token, WETH_token];
      let percentages = [60, 40];

      try {
        await instance.createPortfolio(assets, percentages, { from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_ASSET_NOT_ALLOWED);
      }
    });

    it("should fail to create portfolio if amount of assets is lower than 2", async () => {
      await instance.deposit({ from: userAccount, value: deposit });
      let assets = [UNI_token];
      let percentages = [60];

      try {
        await instance.createPortfolio(assets, percentages, { from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_PORTFOLIO_ASSETS_LENGTH_MIN);
      }
    });

    it("should fail to create portfolio if one asset percentage is < 1", async () => {
      await instance.deposit({ from: userAccount, value: deposit });
      let assets = [UNI_token, BAT_token];
      let percentages = [0, 40];

      try {
        await instance.createPortfolio(assets, percentages, { from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_PORTFOLIO_ASSET_MIN_PERCENTAGE);
      }
    });

    it("should fail to create portfolio if one asset percentage is > 99", async () => {
      await instance.deposit({ from: userAccount, value: deposit });
      let assets = [UNI_token, BAT_token];
      let percentages = [100, 40];

      try {
        await instance.createPortfolio(assets, percentages, { from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_PORTFOLIO_ASSET_MAX_PERCENTAGE);
      }
    });

    it("should fail to create portfolio sum of percentages is not 100", async () => {
      await instance.deposit({ from: userAccount, value: deposit });
      let assets = [UNI_token, BAT_token];
      let percentages = [61, 40];

      try {
        await instance.createPortfolio(assets, percentages, { from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_PORTFOLIO_SUM_PERCENTAGE_NOT_100);
      }
    });

    it("should allow an account with a sealed portfolio to delete a portfolio", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.deletePortfolio({ from: userAccount });
      const portfolioStatus = await instance.getPortfolioStatus(userAccount);

      assert.equal(portfolioStatus.toNumber(), Status.EMPTY, "portfolio should be empty");
    });

    it("should emit an event when a portfolio is created", async () => {
      await instance.deposit({ from: userAccount, value: deposit });
      let assets = [UNI_token, BAT_token];
      let percentages = [60, 40];
      const result = await instance.createPortfolio(assets, percentages, { from: userAccount });

      assert.equal(
        result.logs[0].args.accountAddress,
        userAccount,
        "wrong property accountAddress in create portfolio event"
      );

      assert.equal(
        result.logs[0].args.assets.length,
        2,
        "wrong property accountAddress in create portfolio event"
      );

      assert.equal(
        result.logs[0].args.percentages.length,
        2,
        "wrong property amount in create portfolio event"
      );
    });
  });

  describe("runInitialPortfolioDistribution()", () => {
    it("should allow an account with a sealed portfolio to run the initial distribution", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.runInitialPortfolioDistribution({ from: userAccount });
      const portfolioStatus = await instance.getPortfolioStatus(userAccount);

      assert.equal(portfolioStatus.toNumber(), Status.INITIALIZED, "portfolio should be initialized");
    });

    it("should fail to run the initial distribution if account has not enough balance", async () => {
      try {
        await instance.runInitialPortfolioDistribution({ from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_NOT_ENOUGH_BALANCE);
      }
    });

    it("should fail to run the initial distribution if the portfolio is not sealed", async () => {
      await instance.deposit({ from: userAccount, value: deposit });

      try {
        await instance.runInitialPortfolioDistribution({ from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_PORTFOLIO_NOT_SEALED);
      }
    });

    it("should leave the balance in 0 after running the initial distribution", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.runInitialPortfolioDistribution({ from: userAccount });
      const balance = await instance.balances(userAccount);

      assert.equal(
        balance,
        0,
        "balance should be 0"
      );
    });

    it("should move the account balance to the portfolio balance after running the initial distribution", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.runInitialPortfolioDistribution({ from: userAccount });
      const fullPortfolio = await instance.fetchPortfolio(userAccount);

      for (let i = 0; i < fullPortfolio[3].length; i++) {
        assert.notEqual(fullPortfolio[3][i], 0, "Asset balance should not be 0")
      }
    });

    it("should emit an event when a portfolio runs the initial distribution", async () => {
      await instance.deposit({ from: userAccount, value: deposit });
      let assets = [UNI_token, BAT_token];
      let percentages = [60, 40];
      const result = await instance.createPortfolio(assets, percentages, { from: userAccount });

      assert.equal(
        result.logs[0].args.accountAddress,
        userAccount,
        "wrong property accountAddress in portfolio initialized event"
      );
    });
  });

  describe("runPortfolioRebalance()", () => {
    it("should allow an account with an initialized portfolio to run a rebalance", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.runInitialPortfolioDistribution({ from: userAccount });
      await instance.runPortfolioRebalance({ from: userAccount });
      const portfolioStatus = await instance.getPortfolioStatus(userAccount);

      assert.equal(portfolioStatus.toNumber(), Status.RUNNING, "portfolio should be running");
    });

    it("should fail to run a rebalance if the portfolio is not initialized or running", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      try {
        await instance.runPortfolioRebalance({ from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_PORTFOLIO_MUST_BE_ACTIVE);
      }
    });

    it("should emit an event when a portfolio runs a rebalance", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.runInitialPortfolioDistribution({ from: userAccount });
      const result = await instance.runPortfolioRebalance({ from: userAccount });

      assert.equal(
        result.logs[0].args.accountAddress,
        userAccount,
        "wrong property accountAddress in run portfolio event"
      );
    });
  });

  describe("deletePortfolio()", () => {
    it("should allow an account with an initialized portfolio to delete a portfolio", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.deletePortfolio({ from: userAccount });
      const portfolioStatus = await instance.getPortfolioStatus(userAccount);

      assert.equal(portfolioStatus.toNumber(), Status.EMPTY, "portfolio should be empty");
    });

    it("should allow an account with a running portfolio to delete a portfolio", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.runInitialPortfolioDistribution({ from: userAccount });
      await instance.runPortfolioRebalance({ from: userAccount });
      await instance.deletePortfolio({ from: userAccount });
      const portfolioStatus = await instance.getPortfolioStatus(userAccount);

      assert.equal(portfolioStatus.toNumber(), Status.EMPTY, "portfolio should be empty");
    });

    it("should set the portfolio asset balances to 0 after deleting a portfolio", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.runInitialPortfolioDistribution({ from: userAccount });
      await instance.deletePortfolio({ from: userAccount });
      const fullPortfolio = await instance.fetchPortfolio(userAccount);

      for (let i = 0; i < fullPortfolio[3].length; i++) {
        assert.equal(fullPortfolio[3][i], 0, "Asset balance should be 0")
      }
    });

    it("should set the portfolio asset percentages to 0 after deleting a portfolio", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.deletePortfolio({ from: userAccount });
      const fullPortfolio = await instance.fetchPortfolio(userAccount);

      for (let i = 0; i < fullPortfolio[2].length; i++) {
        assert.equal(fullPortfolio[2][i], 0, "Asset percentage should be 0")
      }
    });

    it("should set the portfolio assets length to 0 after deleting a portfolio", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.deletePortfolio({ from: userAccount });
      const fullPortfolio = await instance.fetchPortfolio(userAccount);

      assert.equal(fullPortfolio[1].length, 0, "Assets length should be 0")
    });

    it("should fail to delete a portfolio if it's already empty", async () => {
      try {
        await instance.deletePortfolio({ from: userAccount });
      } catch (e) {
        const { error, reason } = getErrorObj(e.data);
        assert.equal(error, "revert");
        assert.equal(reason, ERR_NO_PORTFOLIO);
      }
    });

    it("should move the portfolio balance to the account balance when deleting a portfolio", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      await instance.deletePortfolio({ from: userAccount });
      const balance = await instance.balances(userAccount);

      assert.notEqual(
        balance,
        0,
        "balance should not be 0"
      );
    });

    it("should emit an event when a portfolio is deleted", async () => {
      await createValidPortfolio(instance, userAccount, deposit);
      const result = await instance.deletePortfolio({ from: userAccount });

      assert.equal(
        result.logs[0].args.accountAddress,
        userAccount,
        "wrong property accountAddress in deleted portfolio event"
      );
    });
  });
});
