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

    // @notice local store of asset prices
    mapping(address => uint) public assetPrices;

    /// @notice the max amount of assets an account can add in a portfolio
    uint8 public constant MAX_PORTFOLIO_ASSETS = 10;

    struct Portfolio {
        State status;
        mapping(address => uint) assetPercentages;
        mapping(address => uint) assetBalances;
        /// @dev this array make it easy to iterate over the portfolio assets
        address[] assets;
    }

    enum State { Empty, Sealed, Initialized, Running }

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

    /// @notice Emitted when a new portfolio is created
    /// @param assets The assets address
    /// @param percentages The assigned percentage per asset (in order)
    event LogPortfolioCreated(address[] assets, uint[] percentages);

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

    // -----------------------------------------------
    // Methods
    // -----------------------------------------------

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
        State,
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
            portfolios[_accountAddress].status,
            assets,
            percentages,
            assetBalances
        );
    }

    /// @notice Fetch the portfolio status
    /// @param _accountAddress The portfolio account
    /// @return Returns the status
    function getPortfolioStatus(address _accountAddress) public view returns (State) {
        return portfolios[_accountAddress].status;
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

    /// @notice Check if the asset is allowed for use in the contract
    /// @param _assetAddress The address of the token to be added
    function isAllowedAsset(address _assetAddress) private view returns (bool) {
        for (uint i; i < allowedAssets.length; i++) {
            if (allowedAssets[i] == _assetAddress) {
                return true;
            }
        }

        return false;
    }

    /// @notice Creates a portfolio and seal it (close it for changes)
    /// @dev The order is relevant: each percentage will be associated with the corresponding asset by order
    /// @param _assets Assets address (must be an allowed token)
    /// @param _percentages The allocation percentage for each asset
    function createPortfolio(
        address[] memory _assets,
        uint[] memory _percentages)
    external {
        require(balances[msg.sender] > 0, "Not enough funds");
        require(portfolios[msg.sender].status == State.Empty, "Portfolio already created");
        require(_assets.length <= MAX_PORTFOLIO_ASSETS, "Max amount of assets allowed");
        require(_assets.length >= 2, "The minimum amount of assets is 2");
        require(_assets.length == _percentages.length, "Missing data for assets and percentages");

        // check total percentage integrity
        uint total = 0;
        for (uint i = 0; i < _percentages.length; i++) {
            require(_percentages[i] >= 1 && _percentages[i] <= 99, "The percentage range per asset is 1 to 99");
            total += _percentages[i];
        }

        require(total == 100, "The sum of all the percentages must equal 100");

        // check assets integrity and add them to the portfolio
        for (uint i = 0; i < _assets.length; i++) {
            require(isAllowedAsset(_assets[i]), "Asset not allowed");
            portfolios[msg.sender].assetPercentages[_assets[i]] = _percentages[i];
            portfolios[msg.sender].assets.push(_assets[i]);
        }

        // finally, let's seal the portfolio
        portfolios[msg.sender].status = State.Sealed;

        emit LogPortfolioCreated(_assets, _percentages);
    }

    /// @notice Stop the portfolio rebalancing and return the assets balance to ether
    function deletePortfolio() public {
        require(portfolios[msg.sender].status != State.Empty, "There is no portfolio");

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

        portfolios[msg.sender].status = State.Empty;

        emit LogPortfolioDeleted(msg.sender);
    }

    /// @notice Run the first asset distribution once the portfolio is sealed
    function runInitialPortfolioDistribution() public {
        require(balances[msg.sender] > 0, "Not enough balance");
        require(portfolios[msg.sender].status == State.Sealed, "Portfolio must be sealed");

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

    /// @notice Returns the price of a token
    /// @dev TODO: check performance using uniswap factory and pair contracts to retrieve a token price.
    /// @dev TODO: create an asset price cache
    /// @param _token The asset address
    /// @return The asset price in wei
    function getAssetPrice(address _token) public returns (uint)
    {
        uint amount = 10**18;
        address[] memory path = new address[](2);
        path[0] = router.WETH();
        path[1] = _token;

        IERC20(router.WETH()).approve(address(router), amount);
        uint estimatedBuy = router.getAmountsOut(amount, path)[1];

        return (10**18 * 10**18) / estimatedBuy;
    }

    function runPortfolioRebalance() external {

        require(portfolios[msg.sender].status == State.Initialized, "Portfolio must be initialized");

        // 1. update portfolio asset prices
        address assetAddress;
        uint bought;
        for (uint i = 0; i < portfolios[msg.sender].assets.length; i++) {
            assetAddress = portfolios[msg.sender].assets[i];
            assetPrices[assetAddress] = getAssetPrice(assetAddress);
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


    // TO DELETE

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
        for (uint i = 0; i < allowedAssets.length; i++) {
            assetPrices[allowedAssets[i]] = getAssetPrice(allowedAssets[i]);
        }
    }
}
