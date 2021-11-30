const Status = {
  EMPTY: 0,
  SEALED: 1,
  INITIALIZED: 2,
  RUNNING: 3,
};

const tokenSymbols = {
  "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984": "UNI",
  "0xbF7A7169562078c96f0eC1A8aFD6aE50f12e5A99": "BAT",
}

function fetchTokenSymbol (address) {
  return tokenSymbols[address] ?? "Undefined";
}

function fetchTokenAddress (name) {
  return Object.keys(tokenSymbols).find(
    (key) => tokenSymbols[key] === name
  );
}

function shortenAddress (address, num = 3) {
  if (!address) return "";
  return (
    !!address &&
    `${address.substring(0, num + 2)}...${address.substring(
      address.length - num - 1
    )}`
  );
}

const ERR_METAMASK_CONNECT = "Failed to connect to Metamask. Make sure you are in Rinkeby network and have an active account. Check dev console for more details";
const ERR_BALANCER_CONNECT = "Can't connect to Balancer contract. Make sure you are in Rinkeby network and have an active account.";
const ERR_MIN_BALANCE_CREATE_PORTFOLIO = "The min amount to create a portfolio is 0.5 ETH. Please deposit the required amount.";
const ERR_MIN_BALANCE_INIT_PORTFOLIO = "The min amount to initialize a portfolio is 0.5 ETH. Please deposit the required amount.";
const ERR_MIN_BALANCE_REBALANCE_PORTFOLIO = "The min amount to rebalance a portfolio is 0.02 ETH. Please deposit the required amount.";

App = {
  web3Provider: null,
  web3: null,
  contracts: {},
  metamaskAccountID: "",
  metamaskAccountBalance: "0",
  metamaskAccountNetwork: "",
  userPortfolioStatus: Status.EMPTY,

  // user balance in the contract (not in the portfolio)
  userBalancerBalance: 0,
  allowedTokens: [],
  // holds the portfolio data for creation
  createPortfolio: [],
  createdPortfolioTotal: 0,
  assetAssignments: [],
  createPortfolioCoins: [],

  init: async function () {
    App.setInitialState();
    await App.bindEvents();

    return await App.initWeb3();
  },

  initWeb3: async function () {
    /// Find or Inject Web3 Provider
    /// Modern dapp browsers...
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      try {
        // Request account access
        await window.ethereum.enable();
      } catch (error) {
        // User denied account access...
        console.error("Error to connect to metamask: ", error);
        $("#metamaskError").text(ERR_METAMASK_CONNECT);
      }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
      App.web3Provider = window.web3.currentProvider;
    }
    // If no injected web3 instance is detected, fall back to Ganache cli
    else {
      App.web3Provider = new Web3.providers.HttpProvider(
        "http://localhost:8545"
      );
    }

    return await App.getMetamaskAccountID();
  },

  getMetamaskAccountID: async function () {
    App.web3 = new Web3(App.web3Provider);

    // Retrieving accounts
    let userAccount = "";
    try {
      const accounts = await App.web3.eth.getAccounts();
      userAccount = accounts[0];
    } catch (error) {
        // User denied account access...
        console.error("User denied account access: ");
        console.error(error);
        $("#metamaskError").text(ERR_METAMASK_CONNECT);
    }

    if (typeof userAccount == 'undefined' || userAccount.length == 0) {
      return App.showAnonAccount();
    }

    let balance = await App.web3.eth.getBalance(userAccount);
    App.metamaskAccountID = userAccount;
    App.metamaskAccountBalance = Number(
      App.web3.utils.fromWei(balance, "ether")
    ).toFixed(4);

    switch (Number(App.web3Provider.networkVersion)) {
      case 1:
        App.metamaskAccountNetwork = "Mainnet";
        break;
      case 3:
        App.metamaskAccountNetwork = "Ropsten";
        break;
      case 4:
        App.metamaskAccountNetwork = "Rinkeby";
        break;
      case 5:
        App.metamaskAccountNetwork = "Goerli";
        break;
      case 42:
        App.metamaskAccountNetwork = "Kovan";
        break;
      default:
        App.metamaskAccountNetwork = "unknown";
    }

    console.log("metamaskAccountID:", App.metamaskAccountID);
    console.log("metamaskAccountBalance:", App.metamaskAccountBalance);
    console.log("metamaskAccountBalance:", App.metamaskAccountNetwork);

    try {
      await App.initBalancerContract();
      await App.loadUserPortfolio();
    } catch (error) {
      console.error("Error to connect to balancer contract");
      console.error(error);
      $("#metamaskError").text(ERR_BALANCER_CONNECT);

      return App.showAnonAccount();
    }

    return App.showConnectedAccount();
  },

  initBalancerContract: async function () {
    const abi = await $.getJSON("./contracts/Balancer.json");
    const config = await $.getJSON("./contracts/config.json");

    const netId = await App.web3.eth.net.getId();
    const deployedNetwork = config.networks[netId];
    App.contracts.balancer = new App.web3.eth.Contract(
      abi,
      deployedNetwork && deployedNetwork.address
    );
  },

  formatETH: function (value) {
    return Number(App.web3.utils.fromWei(value)).toFixed(4);
  },

  loadUserPortfolio: async function () {
    let balance = (
      await App.contracts.balancer.methods
        .balances(App.metamaskAccountID)
        .call()
    ).toString();
    App.userBalancerBalance = balance;
    console.log("User balancer balance: " + App.userBalancerBalance);

    await App.loadUserFullPortfolio();

    App.showUserBalancerBalance();
  },

  loadUserFullPortfolio: async function () {
    const portfolio = await App.contracts.balancer.methods
      .fetchPortfolio(App.metamaskAccountID)
      .call();
    console.log("Balancer portfolio: ", portfolio);
    const assetPrices = await App.contracts.balancer.methods
      .fetchAssetsPrices()
      .call();

    App.userPortfolioStatus = Number(portfolio[0]);
    console.log("User portfolio status: ", App.userPortfolioStatus);

    let price;
    let bal;
    let total = App.web3.utils.toBN(0);
    this.assetAssignments = [];
    for (let i = 0; i < portfolio[1].length; i++) {
      price = 0;
      for (let j = 0; j < assetPrices[0].length; j++) {
        if (portfolio[1][i] == assetPrices[0][j]) {
          price = App.web3.utils.toBN(assetPrices[1][j]);
        }
      }

      bal = price.mul(App.web3.utils.toBN(portfolio[3][i]));
      bal = bal.div(App.web3.utils.toBN(1e18));

      total = bal.add(total);

      console.log("El bal es ", bal);

      this.assetAssignments[i] = {
        address: portfolio[1][i],
        percentage: portfolio[2][i],
        balance: portfolio[3][i],
        price: price.toString(),
        balanceWithPrice: bal,
      };
    }

    App.createdPortfolioTotal = total;

    console.log("Full portfolio: ", this.assetAssignments);
    console.log("Total ", total.toString());
  },

  showScreen: function (screen) {
    let screens = [
      "depositScreen",
      "withdrawScreen",
      "createPortfolioScreen",
      "managePortfolioScreen",
      "deletePortfolioScreen",
    ]

    let menuItems = [
      "btnMenuDeposit",
      "btnMenuWithdraw",
      "btnMenuCreatePortfolio",
      "btnMenuManagePortfolio",
      "btnMenuDeletePortfolio",
    ]

    for (let i = 0; i < screens.length; i++) {
      if (screens[i] == screen) {
        $("#" + screens[i]).show();
        $("#" + menuItems[i]).addClass("menu-active")
      } else {
        $("#" + screens[i]).hide();
        $("#" + menuItems[i]).removeClass("menu-active")
      }
    }
  },

  /**
   * Set the app initial state
   */
  setInitialState: function () {
    $("#anonMain").show();
    $("#connectedMain").hide();
    $("#topNavbar").hide();
    $("#btnDeposit").addClass("disabled");
    $("#btnWithdraw").addClass("disabled");
  },

  /**
   * Declare all the binding events for each app element
   */
  bindEvents: async function () {
    $("#btnMenuDeposit").on("click", async (e) => {
      e.preventDefault();
      this.showScreen("depositScreen");
    });

    $("#btnMenuWithdraw").on("click", async (e) => {
      e.preventDefault();
      this.showScreen("withdrawScreen");
    });

    $("#btnMenuCreatePortfolio").on("click", async (e) => {
      e.preventDefault();
      this.showScreen("createPortfolioScreen");
    });

    $("#btnMenuManagePortfolio").on("click", async (e) => {
      e.preventDefault();
      this.showScreen("managePortfolioScreen");
    });

    $("#btnMenuDeletePortfolio").on("click", async (e) => {
      e.preventDefault();
      this.showScreen("deletePortfolioScreen");
    });

    $("#btnConnectMetamask").on("click", async (e) => {
      e.preventDefault();
      await App.initWeb3();
    });

    const btnDeposit = $("#btnDeposit");
    $("#inputDepositAmount").on("keyup", (value) => {
      if (value.target.value > 0 && value.target.value < 10) {
        btnDeposit.removeClass("disabled");
      } else {
        btnDeposit.addClass("disabled");
      }
    });

    btnDeposit.on("click", async (e) => {
      e.preventDefault();
      $("#depositError").text("");
      btnDeposit.addClass("disabled");
      btnDeposit.text("Loading...");
      let depositValue = $("#inputDepositAmount").val();
      try {
        await App.contracts.balancer.methods.deposit().send({
          from: App.metamaskAccountID,
          value: App.web3.utils.toWei(depositValue, "ether"),
        });
      } catch (error) {
        console.log("Failed to deposit");
        console.error(error);
        $("#depositError").text("Failed to make deposit. If the problem persist make sure to reset your MM account and try again.");
        btnDeposit.removeClass("disabled");
        btnDeposit.text("Deposit");
        $("#inputDepositAmount").val("");

        return
      }

      btnDeposit.removeClass("disabled");
      btnDeposit.text("Deposit");
      $("#inputDepositAmount").val("");

      // on success
      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });

    const btnWithdraw = $("#btnWithdraw");
    $("#inputWithdrawAmount").on("keyup", (value) => {
      // TODO: validate the input amount is a valid number
      if (value.target.value > 0) {
        btnWithdraw.removeClass("disabled");
      } else {
        btnWithdraw.addClass("disabled");
      }
    });

    btnWithdraw.on("click", async (e) => {
      e.preventDefault();
      btnWithdraw.addClass("disabled");
      btnWithdraw.text("Loading...");
      let withdrawValue = $("#inputWithdrawAmount").val();
      withdrawValue = App.web3.utils.toWei(withdrawValue);

      // if the user enters a bigger amount than their balance, let's withdraw the total balance
      let userBalance = App.web3.utils.toBN(App.userBalancerBalance);

      // to avoid precision errors because the user will enter ether amount but the real balance is in wei
      let minThreshold = App.web3.utils.toBN(App.web3.utils.toWei('0.01'));
      if ((App.web3.utils.toBN(withdrawValue).sub(userBalance)).lt(minThreshold)) {
        withdrawValue = userBalance.toString();
      }

      try {
        await App.contracts.balancer.methods
          .withdraw(withdrawValue)
          .send({ from: App.metamaskAccountID });
      } catch (error) {
        console.log("Failed to withdraw");
        console.error(error);
        $("#withdrawError").text("Failed to withdraw. If the problem persist make sure to reset your MM account and try again.");

        btnWithdraw.removeClass("disabled");
        btnWithdraw.text("Withdraw");
        $("#inputWithdrawAmount").val("");

        return;
      }

      btnWithdraw.removeClass("disabled");
      btnWithdraw.text("Withdraw");
      $("#inputWithdrawAmount").val("");

      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });

    const btnConfirmPortfolio = $("#btnConfirmPortfolio");
    btnConfirmPortfolio.on("click", async (e) => {
      e.preventDefault();
      $("#createPortfolioError").text("");
      if (!App.validateCreatePortfolio()) {
        return;
      }

      btnConfirmPortfolio.addClass("disabled");
      btnConfirmPortfolio.text("Loading...");

      console.log("About to create portfolio: ", App.createPortfolio);
      let assets = [];
      let percentages = [];
      for (let i = 0; i < App.createPortfolio.length; i++) {
        assets.push(App.createPortfolio[i].asset);
        percentages.push(App.createPortfolio[i].value);
      }

      try {
        await App.contracts.balancer.methods
          .createPortfolio(assets, percentages)
          .send({ from: App.metamaskAccountID });
      } catch (error) {
        console.log("Failed to create portfolio");
        console.error(error);
        $("#createPortfolioError").text("Failed to create portfolio. If the problem persist make sure to reset your MM account and try again.");

        btnConfirmPortfolio.removeClass("disabled");
        btnConfirmPortfolio.text("Confirm");

        return;
      }

      btnConfirmPortfolio.removeClass("disabled");
      btnConfirmPortfolio.text("Confirm");

      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });

    const btnRunInitPortfolio = $("#btnRunInitPortfolio");
    $("#btnRunInitPortfolio").on("click", async (e) => {
      e.preventDefault();

      $("#runInitPortfolioError").text("");
      if (!App.validateRunInitPortfolio()) {
        return;
      }

      btnRunInitPortfolio.addClass("disabled");
      btnRunInitPortfolio.text("Loading...");

      try {
        await App.contracts.balancer.methods
          .runInitialPortfolioDistribution()
          .send({ from: App.metamaskAccountID });
      } catch (error) {
        console.log("Failed to initialize portfolio");
        console.error(error);
        $("#runInitPortfolioError").text("Failed to initialize portfolio. If the problem persist make sure to reset your MM account and try again.");

        btnRunInitPortfolio.removeClass("disabled");
        btnRunInitPortfolio.text("Run Initial Portfolio distribution");

        return;
      }

      btnRunInitPortfolio.removeClass("disabled");
      btnRunInitPortfolio.text("Run Initial Portfolio distribution");

      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });

    const btnRunPortfolioRebalance = $("#btnRunPortfolioRebalance");
    btnRunPortfolioRebalance.on("click", async (e) => {
      e.preventDefault();

      $("#runPortfolioRebalanceError").text("");
      if (!App.validateRunPortfolioRebalance()) {
        return;
      }

      btnRunPortfolioRebalance.addClass("disabled");
      btnRunPortfolioRebalance.text("Loading...");

      try {
        await App.contracts.balancer.methods
          .runPortfolioRebalance()
          .send({ from: App.metamaskAccountID });
      } catch (error) {
        console.log("Failed to initialize portfolio");
        console.error(error);
        $("#runPortfolioRebalanceError").text("Failed to run portfolio rebalance. If the problem persist make sure to reset your MM account and try again.");

        btnRunPortfolioRebalance.removeClass("disabled");
        btnRunPortfolioRebalance.text("Run Portfolio Rebalance");

        return;
      }

      $("#btnRunPortfolioRebalance").removeClass("disabled");
      btnRunPortfolioRebalance.text("Run Portfolio Rebalance");

      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });

    const btnDeletePortfolio = $("#btnDeletePortfolio");
    btnDeletePortfolio.on("click", async (e) => {
      e.preventDefault();
      $("#deletePortfolioError").text("");
      btnDeletePortfolio.addClass("disabled");
      btnDeletePortfolio.text("Loading...");

      try {
        await App.contracts.balancer.methods
          .deletePortfolio()
          .send({ from: App.metamaskAccountID });
      } catch (error) {
        console.log("Failed to delete portfolio");
        console.error(error);
        $("#deletePortfolioError").text("Failed to delete portfolio. If the problem persist make sure to reset your MM account and try again.");

        btnDeletePortfolio.removeClass("disabled");
        btnDeletePortfolio.text("Delete");

        return;
      }

      btnDeletePortfolio.removeClass("disabled");
      btnDeletePortfolio.text("Delete");

      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });
  },

  validateCreatePortfolio: function () {
    if (App.userBalancerBalance < 500000000000000000) {
      $("#createPortfolioError").text(ERR_MIN_BALANCE_CREATE_PORTFOLIO);
      return false;
    }

    if (App.createPortfolio.length < 2) {
      $("#createPortfolioError").text("You must include at least 2 assets.");
      return false;
    }

    for (let i = 0; i < App.createPortfolio.length; i++) {
      if (App.createPortfolio[i].value < 1 || App.createPortfolio[i].value > 99) {
        $("#createPortfolioError").text("The percentage range for each asset is 1 to 99.");
        return false;
      }
    }

    return true;
  },

  validateRunInitPortfolio: function () {
    $("#runInitPortfolioError").text("");
    if (App.userBalancerBalance < 500000000000000000) {
      $("#runInitPortfolioError").text(ERR_MIN_BALANCE_INIT_PORTFOLIO);
      return false;
    }

    return true;
  },

  validateRunPortfolioRebalance: function () {
    $("#runPortfolioRebalanceError").text("");
    if (App.userBalancerBalance < 20000000000000000) {
      $("#runPortfolioRebalanceError").text(ERR_MIN_BALANCE_REBALANCE_PORTFOLIO);
      return false;
    }

    return true;
  },

  showUserBalancerBalance: function () {
    $("#txtBalancerBalance").text(Number(App.web3.utils.fromWei(App.userBalancerBalance)).toFixed(4) + " ETH");
  },

  isNewUser: function () {
    return App.userBalancerBalance == 0 && App.userPortfolioStatus == Status.EMPTY;
  },

  showAnonAccount: function () {
    $("#anonMain").show();
    $("#connectedMain").hide();
    $("#topNavbar").hide();
  },

  showConnectedAccount: function () {
    $("#anonMain").hide();
    $("#connectedMain").show();
    $("#topNavbar").show();

    $("#navEthNetwork").text(App.metamaskAccountNetwork);
    $("#navEthBalance").text(App.metamaskAccountBalance + " ETH");
    $("#navEthAddress").text(shortenAddress(App.metamaskAccountID));

    const liMenuDeposit = $("#liMenuDeposit");
    const liMenuPortfolio = $("#liMenuPortfolio");
    const liMenuCreatePortfolio = $("#liMenuCreatePortfolio");
    const liMenuManagePortfolio = $("#liMenuManagePortfolio");
    const liMenuDeletePortfolio = $("#liMenuDeletePortfolio");
    const liMenuWithdraw = $("#liMenuWithdraw");

    liMenuDeposit.show();
    if (App.isNewUser()) {
      liMenuPortfolio.hide();
      liMenuWithdraw.hide();
      App.showUserBalancerBalance();
      this.showScreen("depositScreen");
    } else {
      App.showUserBalancerBalance();
      liMenuPortfolio.show();
      liMenuWithdraw.show();

      if (App.userPortfolioStatus == Status.EMPTY) {
        App.displayCreatePortfolioForm();
        this.showScreen("createPortfolioScreen");
        liMenuCreatePortfolio.show();
        liMenuManagePortfolio.hide();
        liMenuDeletePortfolio.hide();
      }

      if (App.userPortfolioStatus == Status.SEALED) {
        this.showScreen("managePortfolioScreen");
        App.displayInitPortfolioForm();
        $("#containerRebalancePortfolio").hide();
        $("#containerInitPortfolio").show();
        liMenuCreatePortfolio.hide();
        liMenuManagePortfolio.show();
        liMenuDeletePortfolio.show();
      }

      if (App.userPortfolioStatus == Status.RUNNING || App.userPortfolioStatus == Status.INITIALIZED) {
        this.showScreen("managePortfolioScreen");
        App.displayManagePortfolioForm();
        $("#containerRebalancePortfolio").show();
        $("#containerInitPortfolio").hide();
        liMenuCreatePortfolio.hide();
        liMenuManagePortfolio.show();
        liMenuDeletePortfolio.show();
      }
    }
  },

  displayCreatePortfolioForm: async function () {

    $("#createPortfolioError").text("");
    if (App.userBalancerBalance < 500000000000000000) {
      $("#createPortfolioError").text(ERR_MIN_BALANCE_CREATE_PORTFOLIO);
    }

    App.allowedTokens = await App.contracts.balancer.methods
      .allowedAssetsList()
      .call();

    console.log("Allowed tokens: ", App.allowedTokens);
    let assets = [];
    App.allowedTokens.map((value, index) => {
      assets.push(value);
    });

    let rows = [];
    let markup;
    $.each(assets, function (index, name) {
      markup =
        '<tr><th scope="row">' +
        (index + 1) +
        "</th><td>" +
        fetchTokenSymbol(name) +
        '</td><td><div class="input-group">' +
        '<input type="text" class="form-control" class="percentage" onKeyUp="App.sum(' +
        index +
        ', this.value)"><span class="input-group-text">%</span></div></td></tr>';

      rows.push(markup);
    });

    let table = $("#createPortfolioTable");
    table.children("tbody").empty();

    $.each(rows, function (index, row) {
      table.children("tbody").append(row);
    });
  },

  sum: function (index, value) {

    App.createPortfolioCoins[index] = Number(value);

    let createPortfolioTotal = 0;
    for (let i = 0; i < App.createPortfolioCoins.length; i++) {
      App.createPortfolio[i] = {
        asset: App.allowedTokens[i],
        value: App.createPortfolioCoins[i],
      };

      createPortfolioTotal += App.createPortfolioCoins[i];
    }

    $("#txtCreatePortfolioTotal").text(createPortfolioTotal);

    if (createPortfolioTotal == 100) {
      $("#btnConfirmPortfolio").removeClass("disabled");
    } else {
      $("#btnConfirmPortfolio").addClass("disabled");
    }
  },

  displayInitPortfolioForm: async function () {
    $("#runInitPortfolioError").text("");
    if (App.userBalancerBalance < 500000000000000000) {
      $("#runInitPortfolioError").text(ERR_MIN_BALANCE_INIT_PORTFOLIO);
    }

    let rows = [];
    let markup;
    this.assetAssignments.map((asset, i) => {
      markup =
        "<tr>" +
        '<th scope="row">' +
        (i + 1) +
        "</th>" +
        "<td>" +
        fetchTokenSymbol(asset.address) +
        "</td>\n" +
        "<td>" +
        asset.percentage +
        "%</td>" +
        "</tr>";

      rows.push(markup);
    });

    let table = $("#initPortfolioTable");
    table.children("tbody").empty();

    $.each(rows, function (index, row) {
      table.children("tbody").append(row);
    });
  },

  displayManagePortfolioForm: async function () {
    $("#runInitPortfolioError").text("");
    if (App.userBalancerBalance < 20000000000000000) {
      $("#runInitPortfolioError").text(ERR_MIN_BALANCE_REBALANCE_PORTFOLIO);
    }

    let rows = [];
    let markup;
    this.assetAssignments.map((asset, i) => {
      markup =
        '<tr><th scope="row">' +
        (i + 1) +
        "</th><td>" +
        fetchTokenSymbol(asset.address) +
        "</td><td>" +
        asset.percentage +
        " %</td><td>" +
        App.formatETH(asset.balance) +
        "</td><td>" +
        App.formatETH(asset.price) +
        " ETH</td><td>" +
        App.formatETH(asset.balanceWithPrice) +
        " ETH</td></tr>"
      ;

      rows.push(markup);
    });

    let table = $("#managePortfolioTable");
    table.children("tbody").empty();

    $.each(rows, function (index, row) {
      table.children("tbody").append(row);
    });

    $("#txtRebalancePortfolioTotalPrice").text(App.formatETH(App.createdPortfolioTotal));
  },
};

async function balancerApp() {
  App.init();
}

balancerApp();
