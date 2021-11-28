// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {}

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts) {}

    function getAmountsOut(uint256 amountIn, address[] calldata path)
    external
    view
    returns (uint256[] memory amounts)
    {}
}

contract Buyer {
    Router router = Router(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D); // uniswap router v2

    mapping(address => uint256) public balances;

    uint256 public out;


    ERC20 WETH_token = ERC20(0xc778417E063141139Fce010982780140Aa0cD5Ab);
    ERC20 UNI_token = ERC20(0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984);
    ERC20 BAT_token = ERC20(0xbF7A7169562078c96f0eC1A8aFD6aE50f12e5A99);

    constructor() {
    }

    receive() external payable {}

    function deposit() public payable returns (uint256) {
        balances[msg.sender] += msg.value;

        // 5. return the balance of sndr of this transaction
        return balances[msg.sender];
    }

    function checkAmountOut(address token2, uint256 amount)
    public

    {
        address token1 = address(WETH_token);

        address[] memory path = new address[](2);
        path[0] = token1;
        path[1] = token2;

        ERC20(token1).approve(address(router), amount);

        uint256[] memory minOuts = router.getAmountsOut(amount, path);

        out = minOuts[1];
    }


    function swapETHForTokens(address token2, uint256 amount)
    public
    returns (uint256)
    {
        address token1 = address(WETH_token);

        address[] memory path = new address[](2);
        path[0] = token1;
        path[1] = token2;

        ERC20(token1).approve(address(router), amount);

        uint256[] memory minOuts = router.getAmountsOut(amount, path);

        router.swapExactETHForTokens{value: amount}(
            minOuts[1],
            path,
            address(this),
            block.timestamp
        );

        return minOuts[1];
    }
}
