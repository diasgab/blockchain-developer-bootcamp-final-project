App = {
  web3Provider: null,
  web3: null,
  contracts: {},
  emptyAddress: "0x0000000000000000000000000000000000000000",
  metamaskAccountID: "",
  metamaskAccountBalance: "0",
  metamaskAccountNetwork: "",
  ownerID: "0x0000000000000000000000000000000000000000",
  userAccountID: "0x0000000000000000000000000000000000000000",
  userHasBalancerBalance: false,
  userHasPortfolio: false,
  userHasPortfolioInit: false,
  balancerBalance: 0,
  hasExistingPortfolio: false,
  createPortfolioTotal: 0,
  createPortfolioCoins: [],
  allowedTokens: [],
  createPortfolio: [],
  assetAssignments: [],
  screens: [
    "depositScreen",
    "withdrawScreen",
    "createPortfolioScreen",
    "managePortfolioScreen",
    "deletePortfolioScreen",
  ],
  tokenSymbols: {
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984": "UNI",
    "0xbF7A7169562078c96f0eC1A8aFD6aE50f12e5A99": "BAT",
  },

  // elements
  anonMain: null,
  connectedMain: null,
  topNavbar: null,
  navEthNetwork: null,
  navEthBalance: null,
  navEthAddress: null,
  txtBalancerBalance: null,
  liMenuDeposit: null,
  liMenuPortfolio: null,
  liMenuCreatePortfolio: null,
  liMenuManagePortfolio: null,
  liMenuDeletePortfolio: null,
  liMenuWithdraw: null,
  btnMenuDeposit: null,
  btnMenuCreatePortfolio: null,
  btnMenuManagePortfolio: null,
  btnMenuDeletePortfolio: null,
  btnMenuWithdraw: null,
  depositScreen: null,
  createPortfolioScreen: null,
  managePortfolioScreen: null,
  deletePortfolioScreen: null,
  withdrawScreen: null,
  btnDeposit: null,
  inputDepositAmount: null,
  createPortfolioTable: null,
  txtCreatePortfolioTotal: null,
  btnConfirmPortfolio: null,
  managePortfolioTable: null,
  btnRunPortfolioRebalance: null,
  btnDeletePortfolio: null,
  btnWithdraw: null,
  inputWithdrawAmount: null,

  init: async function () {
    App.readElements();
    App.setInitialState();

    return await App.initWeb3();
  },

  readElements: function () {
    // main containers
    this.anonMain = $("#anonMain");
    this.connectedMain = $("#connectedMain");

    // top navbar
    this.topNavbar = $("#topNavbar");
    this.navEthNetwork = $("#navEthNetwork");
    this.navEthBalance = $("#navEthBalance");
    this.navEthAddress = $("#navEthAddress");

    // menu
    this.txtBalancerBalance = $("#txtBalancerBalance");
    this.liMenuDeposit = $("#liMenuDeposit");
    this.liMenuPortfolio = $("#liMenuPortfolio");
    this.liMenuCreatePortfolio = $("#liMenuCreatePortfolio");
    this.liMenuManagePortfolio = $("#liMenuManagePortfolio");
    this.liMenuDeletePortfolio = $("#liMenuDeletePortfolio");
    this.liMenuWithdraw = $("#liMenuWithdraw");
    this.btnMenuDeposit = $("#btnMenuDeposit");
    this.btnMenuCreatePortfolio = $("#btnMenuCreatePortfolio");
    this.btnMenuManagePortfolio = $("#btnMenuManagePortfolio");
    this.btnMenuDeletePortfolio = $("#btnMenuDeletePortfolio");
    this.btnMenuWithdraw = $("#btnMenuWithdraw");

    // screens
    this.depositScreen = $("#depositScreen");
    this.createPortfolioScreen = $("#createPortfolioScreen");
    this.managePortfolioScreen = $("#managePortfolioScreen");
    this.deletePortfolioScreen = $("#deletePortfolioScreen");
    this.withdrawScreen = $("#withdrawScreen");

    // deposit
    this.btnDeposit = $("#btnDeposit");
    this.inputDepositAmount = $("#inputDepositAmount");

    // portfolio create
    this.createPortfolioTable = $("#createPortfolioTable");
    this.txtCreatePortfolioTotal = $("#txtCreatePortfolioTotal");
    this.btnConfirmPortfolio = $("#btnConfirmPortfolio");

    // portfolio manage
    this.managePortfolioTable = $("#managePortfolioTable");
    this.btnRunPortfolioRebalance = $("#btnRunPortfolioRebalance");

    // portfolio delete
    this.btnDeletePortfolio = $("#btnDeletePortfolio");

    // withdraw
    this.btnWithdraw = $("#btnWithdraw");
    this.inputWithdrawAmount = $("#inputWithdrawAmount");
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
    // If no injected web3 instance is detected, fall back to Ganache
    else {
      App.web3Provider = new Web3.providers.HttpProvider(
        "http://localhost:7545"
      );
    }

    await App.getMetamaskAccountID();
    if (App.metamaskAccountID.length != 0) {
      await App.initBalancerContract();
      await App.loadUserPortfolio();
      return App.showConnectedAccount();
    }
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

  formatETH: async function (value) {
    return Number(App.web3.utils.fromWei(value)).toFixed(4);
  },

  loadUserPortfolio: async function () {
    let balance = (
      await App.contracts.balancer.methods
        .balances(App.metamaskAccountID)
        .call()
    ).toString();
    App.balancerBalance = Number(App.web3.utils.fromWei(balance)).toFixed(4);
    console.log("Balancer balance: " + App.balancerBalance);

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
    const isSealed = portfolio[0] ? "YES" : "NO";
    this.userHasPortfolio = portfolio[0];
    this.userHasPortfolioInit = portfolio[3][0] != 0;
    console.log("User has portfolio: ", this.userHasPortfolio);

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

    console.log("Full portfolio: ", this.assetAssignments);
    console.log("Total ", total.toString());
  },

  showScreen: function (screen) {
    for (let i = 0; i < this.screens.length; i++) {
      if (this.screens[i] == screen) {
        $("#" + this.screens[i]).show();
      } else {
        $("#" + this.screens[i]).hide();
      }
    }
  },

  setInitialState: async function () {
    this.anonMain.hide();
    this.connectedMain.hide();
    this.topNavbar.hide();

    this.btnMenuDeposit.on("click", async (e) => {
      e.preventDefault();
      this.showScreen("depositScreen");
    });

    this.btnMenuWithdraw.on("click", async (e) => {
      e.preventDefault();
      this.showScreen("withdrawScreen");
    });

    this.btnMenuCreatePortfolio.on("click", async (e) => {
      e.preventDefault();
      this.showScreen("createPortfolioScreen");
    });

    this.btnMenuManagePortfolio.on("click", async (e) => {
      e.preventDefault();
      this.showScreen("managePortfolioScreen");
    });

    this.btnMenuDeletePortfolio.on("click", async (e) => {
      e.preventDefault();
      this.showScreen("deletePortfolioScreen");
    });

    this.btnDeposit.addClass("disabled");
    this.inputDepositAmount.on("keyup", (value) => {
      // TODO: validate the input amount is a valid number
      if (value.target.value > 0) {
        this.btnDeposit.removeClass("disabled");
      } else {
        this.btnDeposit.addClass("disabled");
      }
    });

    this.btnWithdraw.addClass("disabled");
    this.inputWithdrawAmount.on("keyup", (value) => {
      // TODO: validate the input amount is a valid number
      if (value.target.value > 0) {
        this.btnWithdraw.removeClass("disabled");
      } else {
        this.btnWithdraw.addClass("disabled");
      }
    });

    this.btnDeposit.on("click", async (e) => {
      e.preventDefault();
      this.btnDeposit.addClass("disabled");
      let depositValue = App.inputDepositAmount.val();
      await App.contracts.balancer.methods.deposit().send({
        from: App.metamaskAccountID,
        value: App.web3.utils.toWei(depositValue, "ether"),
      });

      this.btnDeposit.removeClass("disabled");
      App.inputDepositAmount.val("");

      // on success
      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });

    this.btnWithdraw.on("click", async (e) => {
      e.preventDefault();
      this.btnWithdraw.addClass("disabled");
      let withdrawValue = App.inputWithdrawAmount.val();
      await App.contracts.balancer.methods
        .withdraw(App.web3.utils.toWei(withdrawValue, "ether"))
        .send({ from: App.metamaskAccountID });

      this.btnWithdraw.removeClass("disabled");
      App.inputWithdrawAmount.val("");

      await App.loadUserPortfolio();
      App.showConnectedAccount();
    });

    this.btnConfirmPortfolio.on("click", async (e) => {
      e.preventDefault();
      this.btnConfirmPortfolio.addClass("disabled");

      console.log("About to create portfolio: ", App.createPortfolio);
      let assets = [];
      let percentages = [];
      for (let i = 0; i < App.createPortfolio.length; i++) {
        assets.push(this.createPortfolio[i].asset);
        percentages.push(this.createPortfolio[i].value);
      }
      await App.contracts.balancer.methods
        .createPortfolio(assets, percentages)
        .send({ from: App.metamaskAccountID });

      this.btnConfirmPortfolio.removeClass("disabled");

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

  shortenAddress: function (address, num = 3) {
    if (!address) return "";
    return (
      !!address &&
      `${address.substring(0, num + 2)}...${address.substring(
        address.length - num - 1
      )}`
    );
  },

  showUserBalancerBalance: function () {
    this.txtBalancerBalance.text(App.balancerBalance + " ETH");
  },

  isNewUser: function () {
    return App.balancerBalance == "0.0000" && !this.userHasPortfolio;
  },

  showConnectedAccount: function () {
    this.anonMain.hide();
    this.connectedMain.show();
    this.topNavbar.show();

    this.navEthNetwork.text(App.metamaskAccountNetwork);
    this.navEthBalance.text(App.metamaskAccountBalance + " ETH");
    this.navEthAddress.text(this.shortenAddress(App.metamaskAccountID));

    if (App.isNewUser()) {
      this.liMenuDeposit.show();
      this.liMenuPortfolio.hide();
      this.liMenuWithdraw.hide();
      App.showUserBalancerBalance();
      this.showScreen("depositScreen");
    } else {
      App.showUserBalancerBalance();
      this.liMenuDeposit.hide();
      this.liMenuPortfolio.show();
      if (!this.userHasPortfolio) {
        App.displayCreatePortfolioForm();
        this.showScreen("createPortfolioScreen");
        this.liMenuCreatePortfolio.show();
        this.liMenuManagePortfolio.hide();
        this.liMenuDeletePortfolio.hide();
      } else {
        if (this.userHasPortfolioInit) {
          $("#containerRebalancePortfolio").show();
          $("#containerInitPortfolio").hide();
          App.displayManagePortfolioForm();
        } else {
          $("#containerRebalancePortfolio").hide();
          $("#containerInitPortfolio").show();
          App.displayInitPortfolioForm();
        }

        this.showScreen("managePortfolioScreen");
        this.liMenuCreatePortfolio.hide();
        this.liMenuManagePortfolio.show();
        this.liMenuDeletePortfolio.show();
      }
      this.liMenuWithdraw.show();
    }
  },

  fetchTokenSymbol: function (address) {
    return App.tokenSymbols[address] ?? "Undefined";
  },

  fetchTokenAddress: function (name) {
    return Object.keys(App.tokenSymbols).find(
      (key) => App.tokenSymbols[key] === name
    );
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
        App.fetchTokenSymbol(name) +
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

    //return App.bindEvents();
  },

  sum: function (index, value) {
    this.createPortfolioCoins[index] = Number(value);

    this.createPortfolioTotal = 0;
    for (let i = 0; i < this.createPortfolioCoins.length; i++) {
      App.createPortfolio[i] = {
        asset: App.allowedTokens[i],
        value: this.createPortfolioCoins[i],
      };
      this.createPortfolioTotal += this.createPortfolioCoins[i];
    }

    App.txtCreatePortfolioTotal.text(this.createPortfolioTotal);

    if (this.createPortfolioTotal == 100) {
      this.btnConfirmPortfolio.removeClass("disabled");
    } else {
      this.btnConfirmPortfolio.addClass("disabled");
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
        App.fetchTokenSymbol(asset.address) +
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
        "<tr>\n" +
        '                <th scope="row">' +
        (i + 1) +
        "</th>\n" +
        "                <td>" +
        App.fetchTokenSymbol(asset.address) +
        "</td>\n" +
        "                <td>" +
        App.formatETH(asset.balanceWithPrice) +
        " ETH</td>\n" +
        "                <td>" +
        asset.percentage +
        "%</td>\n" +
        "                <td>17%</td>\n" +
        '                <td class="text-danger">-3%</td>\n' +
        "                <td>Buy</td>\n" +
        "              </tr>";

      rows.push(markup);
    });

    let $table = $("#managePortfolioTable");
    $table.children("tbody").empty();

    $.each(rows, function (index, row) {
      $table.children("tbody").append(row);
    });
  },
};

async function balancerApp() {
  App.init();
}

balancerApp();
