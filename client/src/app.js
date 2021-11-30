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
        console.error("User denied account access");
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
    const accounts = await App.web3.eth.getAccounts();

    let balance = await App.web3.eth.getBalance(accounts[0]);
    App.metamaskAccountID = accounts[0];
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

    if (App.metamaskAccountID.length != 0) {
      await App.initBalancerContract();
      await App.loadUserPortfolio();

      return App.showConnectedAccount();
    }

    return App.showAnonAccount();
  },

  initBalancerContract: async function () {
    const data = await $.getJSON("./contracts/Balancer.json");

    const netId = await App.web3.eth.net.getId();
    const deployedNetwork = data.networks[netId];
    App.contracts.balancer = new App.web3.eth.Contract(
      data.abi,
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
    App.userBalancerBalance = Number(App.web3.utils.fromWei(balance)).toFixed(4);
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

    for (let i = 0; i < screens.length; i++) {
      if (screens[i] == screen) {
        $("#" + screens[i]).show();
      } else {
        $("#" + screens[i]).hide();
      }
    }
  },

  /**
   * Set the app initial state
   */
  setInitialState: function () {
    $("#anonMain").hide();
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

    const btnDeposit = $("#btnDeposit");
    $("#inputDepositAmount").on("keyup", (value) => {
      // TODO: validate the input amount is a valid number
      if (value.target.value > 0) {
        btnDeposit.removeClass("disabled");
      } else {
        btnDeposit.addClass("disabled");
      }
    });

    btnDeposit.on("click", async (e) => {
      e.preventDefault();
      btnDeposit.addClass("disabled");
      let depositValue = $("#inputDepositAmount").val();
      await App.contracts.balancer.methods.deposit().send({
        from: App.metamaskAccountID,
        value: App.web3.utils.toWei(depositValue, "ether"),
      });

      btnDeposit.removeClass("disabled");
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
      let withdrawValue = $("#inputWithdrawAmount").val();
      await App.contracts.balancer.methods
        .withdraw(App.web3.utils.toWei(withdrawValue, "ether"))
        .send({ from: App.metamaskAccountID });

      btnWithdraw.removeClass("disabled");
      $("#inputWithdrawAmount").val("");

      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });

    const btnConfirmPortfolio = $("#btnConfirmPortfolio");
    btnConfirmPortfolio.on("click", async (e) => {
      e.preventDefault();
      btnConfirmPortfolio.addClass("disabled");

      console.log("About to create portfolio: ", App.createPortfolio);
      let assets = [];
      let percentages = [];
      for (let i = 0; i < App.createPortfolio.length; i++) {
        assets.push(App.createPortfolio[i].asset);
        percentages.push(App.createPortfolio[i].value);
      }

      await App.contracts.balancer.methods
        .createPortfolio(assets, percentages)
        .send({ from: App.metamaskAccountID });

      btnConfirmPortfolio.removeClass("disabled");

      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });

    $("#btnRunInitPortfolio").on("click", async (e) => {
      e.preventDefault();
      $("#btnRunInitPortfolio").addClass("disabled");
      await App.contracts.balancer.methods
        .runInitialPortfolioDistribution()
        .send({ from: App.metamaskAccountID });

      $("#btnRunInitPortfolio").removeClass("disabled");

      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });

    $("#btnRunPortfolioRebalance").on("click", async (e) => {
      e.preventDefault();
      $("#btnRunPortfolioRebalance").addClass("disabled");
      await App.contracts.balancer.methods
        .runPortfolioRebalance()
        .send({ from: App.metamaskAccountID });

      $("#btnRunPortfolioRebalance").removeClass("disabled");

      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });

    $("#btnDeletePortfolio").on("click", async (e) => {
      e.preventDefault();
      $("#btnDeletePortfolio").addClass("disabled");
      await App.contracts.balancer.methods
        .deletePortfolio()
        .send({ from: App.metamaskAccountID });

      $("#btnDeletePortfolio").removeClass("disabled");

      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });
  },

  showUserBalancerBalance: function () {
    $("#txtBalancerBalance").text(App.userBalancerBalance + " ETH");
  },

  isNewUser: function () {
    return App.userBalancerBalance == "0.0000" && App.userPortfolioStatus == Status.EMPTY;
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

    if (App.isNewUser()) {
      liMenuDeposit.show();
      liMenuPortfolio.hide();
      liMenuWithdraw.hide();
      App.showUserBalancerBalance();
      this.showScreen("depositScreen");
    } else {
      App.showUserBalancerBalance();
      liMenuDeposit.hide();
      liMenuPortfolio.show();
      if (App.userPortfolioStatus == Status.EMPTY) {
        App.displayCreatePortfolioForm();
        this.showScreen("createPortfolioScreen");
        liMenuCreatePortfolio.show();
        liMenuManagePortfolio.hide();
        liMenuDeletePortfolio.hide();
      } else {
        if (App.userPortfolioStatus == Status.RUNNING) {
          $("#containerRebalancePortfolio").show();
          $("#containerInitPortfolio").hide();
          App.displayManagePortfolioForm();
        } else {
          $("#containerRebalancePortfolio").hide();
          $("#containerInitPortfolio").show();
          App.displayInitPortfolioForm();
        }

        this.showScreen("managePortfolioScreen");
        liMenuCreatePortfolio.hide();
        liMenuManagePortfolio.show();
        liMenuDeletePortfolio.show();
      }
      liMenuWithdraw.show();
    }
  },

  displayCreatePortfolioForm: async function () {
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

    let $table = $("#createPortfolioTable");
    $table.children("tbody").empty();

    $.each(rows, function (index, row) {
      $table.children("tbody").append(row);
    });
  },

  sum: function (index, value) {
    console.log("QUE PASO");

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

    let $table = $("#initPortfolioTable");
    $table.children("tbody").empty();

    $.each(rows, function (index, row) {
      $table.children("tbody").append(row);
    });
  },

  displayManagePortfolioForm: async function () {
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

    let $table = $("#managePortfolioTable");
    $table.children("tbody").empty();

    $.each(rows, function (index, row) {
      $table.children("tbody").append(row);
    });

    $("#txtRebalancePortfolioTotalPrice").text(App.formatETH(App.createdPortfolioTotal));
  },
};

async function balancerApp() {
  App.init();
}

balancerApp();
