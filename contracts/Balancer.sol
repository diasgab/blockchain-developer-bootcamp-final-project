// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import './interfaces/IUniswapV2Router02.sol';
import './interfaces/IERC20.sol';

/**
 * @title Hold a user portfolio with multiple assets
 * @author Gabriel R. Dias
 * @notice This is an experimental contract, don't use in production environment
 */
contract Balancer is Ownable {

    // -----------------------------------------------
    // Properties
    // -----------------------------------------------

    IUniswapV2Router02 public router;

    /// @notice Holds an account balance in the contract (not assigned to any asset in a portfolio)
    mapping(address => uint) public balances;

    /// @notice allowed assets that can be part of a portfolio (to be edited only by contract owner)
    address[] public allowedAssets;

    /// @notice the max amount of assets an account can add in a portfolio
    uint8 public constant MAX_PORTFOLIO_ASSETS = 10;

    struct Portfolio {
        /// @notice once a portfolio is sealed no more changes are allowed in it (it must be deleted)
        /// @dev sealed is a reserved word
        bool sealedPortfolio;
        mapping(address => uint) assetPercentages;
        mapping(address => uint) assetBalances;
        /// @dev this array make it easy to iterate over the portfolio assets
        address[] assets;
    }

    /// @notice Holds an account portfolio
    mapping(address => Portfolio) public portfolios;

    // -----------------------------------------------
    // Events
    // -----------------------------------------------

    /// @notice Emitted when a new allowed asset is added to the contract
    /// @param assetAddress The asset address
    event LogAllowedAssetAdded(address assetAddress);

    /// @notice Emitted when a new deposit is made
    /// @param accountAddress The deposit address
    /// @param amount The deposit amount
    event LogDepositMade(address accountAddress, uint amount);

    /// @notice Emitted when a withdraw is made
    /// @param accountAddress The withdraw address
    /// @param withdrawAmount The withdraw amount
    /// @param newBalance The new balance after the withdraw
    event LogWithdrawal(
        address accountAddress,
        uint withdrawAmount,
        uint newBalance
    );

    /// @notice Emitted when a new asset is added to a portfolio
    /// @param assetAddress The asset address
    /// @param percentage The assigned percentage
    event LogPortfolioAssetAdded(address assetAddress, uint percentage);

    /// @notice Emitted when a portfolio is sealed
    /// @param accountAddress The account which performed the operation
    event LogPortfolioSealed(address accountAddress);

    /// @notice Emitted when a portfolio is deleted
    /// @param accountAddress The account which performed the operation
    event LogPortfolioDeleted(address accountAddress);

    // -----------------------------------------------
    // Modifiers
    // -----------------------------------------------

    /// @notice Check is a valid asset
    /// @param _assetAddress The address of the asset to check
    modifier isValidAsset(address _assetAddress) {
        // TODO: check the address is a ERC20 token which supports 18 decimals
        _;
    }

    /// @notice Check the asset is not already added to the allowed list
    /// @param _assetAddress The address of the token to be added
    modifier isNewAllowedAsset(address _assetAddress) {
        bool isNew = true;
        for (uint i; i < allowedAssets.length; i++) {
            if (allowedAssets[i] == _assetAddress) {
                isNew = false;
            }
        }
        require(isNew, "Asset is allowed already");
        _;
    }

    /// @notice Check if the asset is allowed for use in the contract
    /// @param _assetAddress The address of the token to be added
    modifier isAllowedAsset(address _assetAddress) {
        bool isAllowed = false;
        for (uint i; i < allowedAssets.length; i++) {
            if (allowedAssets[i] == _assetAddress) {
                isAllowed = true;
            }
        }
        require(isAllowed, "Token not allowed");
        _;
    }

    // -----------------------------------------------
    // Methods
    // -----------------------------------------------

    // constructor
    constructor (address _router) {
        // uniswap router
        router = IUniswapV2Router02(_router);
    }

    // fallback method
    receive() external payable {}

    /// @notice Let the contract owner add new allowed tokens
    /// @param _assetAddress Token address
    function addAllowedAsset(address _assetAddress)
    public
    isValidAsset(_assetAddress)
    isNewAllowedAsset(_assetAddress)
    onlyOwner
    {
        allowedAssets.push(_assetAddress);

        emit LogAllowedAssetAdded(_assetAddress);
    }
    
    /// @return The allowed assets in the contract
    function allowedAssetsList() public view returns (address[] memory) {
        return allowedAssets;
    }

    /// @notice Reveal an account portfolio
    /// @param _accountAddress The portfolio account
    /// @return The account portfolio
    function fetchPortfolio(address _accountAddress) public view returns
    (
        bool,
        address[] memory,
        uint[] memory,
        uint[] memory
    )
    {
        uint count = portfolios[_accountAddress].assets.length;

        address assetAddress;
        address[] memory assets = new address[](count);
        uint[] memory percentages = new uint[](count);
        uint[] memory assetBalances = new uint[](count);

        for (uint i = 0; i < count; i++) {
            assetAddress = portfolios[_accountAddress].assets[i];
            assets[i] = assetAddress;
            percentages[i] = portfolios[_accountAddress].assetPercentages[assetAddress];
            assetBalances[i] = portfolios[_accountAddress].assetBalances[assetAddress];
        }

        return (
            portfolios[_accountAddress].sealedPortfolio,
            assets,
            percentages,
            assetBalances
        );
    }

    /// @notice Determines whether a portfolio is sealed or not
    /// @param _accountAddress The portfolio account
    /// @return Returns boolean answering the question
    function isPortfolioSealed(address _accountAddress) public view returns (bool) {
        return portfolios[_accountAddress].sealedPortfolio;
    }

    /// @notice Deposit ether in the contract
    /// @return The balance of the account after the deposit is made
    function deposit() public payable returns (uint) {
        require(msg.value > 0, "Deposit value must be grater than zero");
        balances[msg.sender] += msg.value;
        emit LogDepositMade(msg.sender, msg.value);

        return balances[msg.sender];
    }

    /// @notice Withdraw ether from the contract
    /// @dev This does not return any excess ether sent to it
    /// @param _withdrawAmount amount to withdraw
    /// @return The balance remaining for the account performing the operation
    function withdraw(uint _withdrawAmount) public returns (uint) {
        require(balances[msg.sender] >= _withdrawAmount, "Not enough funds");
        balances[msg.sender] -= _withdrawAmount;

        payable(msg.sender).transfer(_withdrawAmount);

        emit LogWithdrawal(msg.sender, _withdrawAmount, balances[msg.sender]);

        return balances[msg.sender];
    }

    /// @notice Calculate the sum af all asset percentages for a given account in a portfolio
    /// @param _accountAddress The account address
    /// @return The total sum
    function calculatePortfolioTotalAssignments(address _accountAddress)
    private
    view
    returns (uint)
    {
        uint total = 0;
        for (uint i = 0; i < portfolios[_accountAddress].assets.length; i++) {
            total += portfolios[_accountAddress].assetPercentages[portfolios[_accountAddress].assets[i]];
        }

        return total;
    }

    /// @notice Add one asset to the portfolio
    /// @param _assetAddress Asset address (must be an allowed token)
    /// @param _percentage The allocation percentage for the given asset
    function addPortfolioAsset(address _assetAddress, uint _percentage)
    public
    isAllowedAsset(_assetAddress)
    {
        require(
            portfolios[msg.sender].assets.length < MAX_PORTFOLIO_ASSETS,
            "Max amount of tokens reached"
        );
        require(
            balances[msg.sender] > 0,
            "A deposit must be made"
        );
        require(
            _percentage < 100,
            "The maximum percentage for a given asset is 99"
        );
        require(
            _percentage > 0,
            "The minimum percentage for a given asset is 1"
        );
        require(
            !portfolios[msg.sender].sealedPortfolio,
            "Portfolio not open for changes"
        );
        require(
            portfolios[msg.sender].assetPercentages[_assetAddress] == 0,
            "Portfolio asset already exists in portfolio"
        );

        portfolios[msg.sender].assetPercentages[_assetAddress] = _percentage;
        // NOTE: we might not reached the 100% of the portfolio assignments yet
        require(calculatePortfolioTotalAssignments(msg.sender) <= 100, "Invalid portfolio distribution");

        // NOTE: this is redundant because the default value should be zero anyway
        portfolios[msg.sender].assetBalances[_assetAddress] = 0;
        portfolios[msg.sender].assets.push(_assetAddress);

        emit LogPortfolioAssetAdded(_assetAddress, _percentage);
    }

    /// @notice Check the portfolio integrity and close it for changes
    function sealPortfolio() public {
        require(!portfolios[msg.sender].sealedPortfolio, "Portfolio already sealed");
        require(portfolios[msg.sender].assets.length > 1, "Portfolio must contain at least 2 assets");
        require(calculatePortfolioTotalAssignments(msg.sender) == 100, "Invalid portfolio distribution");

        portfolios[msg.sender].sealedPortfolio = true;
        emit LogPortfolioSealed(msg.sender);
    }

    function createFullPortfolio(address[] memory assets, uint[] memory percentages) public {

        require(!portfolios[msg.sender].sealedPortfolio, "Portfolio already sealed");
        require(assets.length == percentages.length, "Missing data for assets and percentages");
        require(assets.length <= MAX_PORTFOLIO_ASSETS, "Max amount of tokens allowed");

        for (uint i = 0; i < assets.length; i++) {
            addPortfolioAsset(assets[i], percentages[i]);
        }

        sealPortfolio();
    }

    /// @notice Stop the portfolio rebalancing and return the assets balance to ether
    function deletePortfolio() public {
        require(portfolios[msg.sender].sealedPortfolio, "There is no portfolio");

        uint bought;
        address assetAddress;
        for (uint i = 0; i < portfolios[msg.sender].assets.length; i++) {

            assetAddress = portfolios[msg.sender].assets[i];
            if (portfolios[msg.sender].assetBalances[assetAddress] > 0) {
                bought = swapTokensForETH(
                    assetAddress,
                    portfolios[msg.sender].assetBalances[assetAddress]
                );

                // increment the account balance with the result of the assets sold
                balances[msg.sender] += bought;
                portfolios[msg.sender].assetBalances[assetAddress] = 0;
                portfolios[msg.sender].assetPercentages[assetAddress] = 0;
            }

            // delete the asset from the portfolio assets list
            portfolios[msg.sender].assets.pop();
        }

        portfolios[msg.sender].sealedPortfolio = false;

        emit LogPortfolioDeleted(msg.sender);
    }

    /// @notice Run the first asset distribution once the portfolio is sealed
    function runInitialPortfolioDistribution() public {
        require(balances[msg.sender] > 0, "Not enough balance");
        require(portfolios[msg.sender].sealedPortfolio, "Portfolio must be sealed");

        uint initialBalance = balances[msg.sender];
        uint percentage;
        uint bought;
        uint desiredAmountToSpend;
        address _assetAddress;
        for (uint i = 0; i < portfolios[msg.sender].assets.length; i++) {
            _assetAddress = portfolios[msg.sender].assets[i];
            percentage = portfolios[msg.sender].assetPercentages[_assetAddress];
            desiredAmountToSpend = (initialBalance * percentage) / 100;

            require(
                desiredAmountToSpend <= balances[msg.sender],
                "Reached max balance to spend"
            );

            bought = swapETHForTokens(_assetAddress, desiredAmountToSpend);

            assetPrices[allowedAssets[i]] = (10**18 * desiredAmountToSpend) / bought;
            portfolios[msg.sender].assetBalances[_assetAddress] += bought;
            balances[msg.sender] -= desiredAmountToSpend;
        }
    }

    /// @notice Swap ETH amount for tokens
    /// @param _destTokenAddress The destination token address
    /// @param _amountIn The amount of ETH to exchange
    /// @return The amount of tokens bought
    function swapETHForTokens(address _destTokenAddress, uint _amountIn)
    public
    returns (uint)
    {
        /// @dev When using ether in the path, the WETH token address is needed because there is no address for ether ;)
        address origTokenAddress = router.WETH();

        address[] memory path = new address[](2);
        path[0] = origTokenAddress;
        path[1] = _destTokenAddress;

        IERC20(origTokenAddress).approve(address(router), _amountIn);

        uint[] memory minOuts = router.getAmountsOut(_amountIn, path);

        router.swapExactETHForTokens{value: _amountIn}(
            minOuts[1],
            path,
            address(this),
            block.timestamp
        );

        return minOuts[1];
    }

    /// @notice Swap tokens amount for ETH
    /// @param _origTokenAddress The origin token address
    /// @param _amountIn The amount of tokens to exchange
    /// @return The amount of ETH bought
    function swapTokensForETH(address _origTokenAddress, uint _amountIn)
    public
    returns (uint)
    {
        address destTokenAddress = router.WETH();

        address[] memory path = new address[](2);
        path[0] = _origTokenAddress;
        path[1] = destTokenAddress;

        IERC20(_origTokenAddress).approve(address(router), _amountIn);

        uint[] memory minOuts = router.getAmountsOut(_amountIn, path);

        router.swapExactTokensForETH(
            _amountIn,
            minOuts[1],
            path,
            address(this),
            block.timestamp
        );

        return minOuts[1];
    }

    // -----------------------------------------------
    // Experimental
    // -----------------------------------------------

    // we need this to simulate a price change. We need a source to populate these values
    mapping(address => uint) public assetPrices;

    function fetchAssetsPrices() public view returns (address[] memory, uint[] memory) {
        address[] memory assets = new address[](allowedAssets.length);
        uint[] memory prices = new uint[](allowedAssets.length);

        for (uint i; i < allowedAssets.length; i++) {
            assets[i] = allowedAssets[i];
            prices[i] = assetPrices[allowedAssets[i]];
        }

        return (assets, prices);
    }

    function updateAssetPrices() external {
        uint bought;
        for (uint i = 0; i < allowedAssets.length; i++) {
            bought = checkAmountOut(allowedAssets[i], 10**18);
            assetPrices[allowedAssets[i]] = (10**18 * 10**18) / bought;
        }
    }

    function checkAmountOut(address token2, uint amount)
    public
    returns (uint)
    {
        address token1 = router.WETH();

        address[] memory path = new address[](2);
        path[0] = token1;
        path[1] = token2;

        IERC20(token1).approve(address(router), amount);

        uint[] memory minOuts = router.getAmountsOut(amount, path);

        return minOuts[1];
    }

    function runPortfolioRebalance() external {

        // 1. update portfolio asset prices
        address assetAddress;
        uint bought;
        for (uint i = 0; i < portfolios[msg.sender].assets.length; i++) {
            assetAddress = portfolios[msg.sender].assets[i];
            bought = checkAmountOut(assetAddress, 10**18);
            assetPrices[assetAddress] = (10**18 * 10**18) / bought;
        }

        // 2. calculate the new portfolio total value
        uint currentHolding;
        uint[] memory newHoldingValue = new uint[](portfolios[msg.sender].assets.length);
        uint newPortfolioTotalBalance = 0;
        for (uint i = 0; i < portfolios[msg.sender].assets.length; i++) {
            assetAddress = portfolios[msg.sender].assets[i];

            // get the current holding for the coin
            currentHolding = portfolios[msg.sender].assetBalances[assetAddress];

            newHoldingValue[i] = (assetPrices[assetAddress] * currentHolding) / 10**18;
            newPortfolioTotalBalance += newHoldingValue[i];
        }

        // TODO: is the new balance is not that grater than the old balance, then stop!

        // 3. Prepare buy and sell orders
        uint gasReserve = 30000000000000000;
        newPortfolioTotalBalance = newPortfolioTotalBalance - gasReserve;

        uint percentage;
        int diff;
        uint[] memory sellOrders = new uint[](portfolios[msg.sender].assets.length);
        uint[] memory buyOrders = new uint[](portfolios[msg.sender].assets.length);
        for (uint i = 0; i < portfolios[msg.sender].assets.length; i++) {
            assetAddress = portfolios[msg.sender].assets[i];

            // get current percentage
            percentage = portfolios[msg.sender].assetPercentages[assetAddress];
            diff =
            int((newPortfolioTotalBalance * percentage) / 100) -
            int(newHoldingValue[i]);

            if (diff > 0) {
                buyOrders[i] = uint(diff);
            } else {
                sellOrders[i] = uint(-diff);
            }
        }

        // 4. Execute sell orders
        uint amountToSwap;
        for (uint i = 0; i < sellOrders.length; i++) {
            if (sellOrders[i] > 0) {
                assetAddress = portfolios[msg.sender].assets[i];
                amountToSwap = (sellOrders[i] * 10**18) / assetPrices[assetAddress];

                bought = swapTokensForETH(assetAddress, amountToSwap);
                balances[msg.sender] += bought;
                portfolios[msg.sender].assetBalances[assetAddress] -= amountToSwap;
            }
        }

        // 5. Execute buy orders
        for (uint i = 0; i < buyOrders.length; i++) {
            if (buyOrders[i] > 0) {
                assetAddress = portfolios[msg.sender].assets[i];
                amountToSwap = buyOrders[i];

                bought = swapETHForTokens(assetAddress, amountToSwap);

                portfolios[msg.sender].assetBalances[assetAddress] += bought;
                balances[msg.sender] -= amountToSwap;
            }
        }

        // 6. Handle any remaining balance
        // TODO: handle the gas reserve properly
        //balances[msg.sender] += gasReserve;
    }
}
