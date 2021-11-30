# Design patterns used

## Inter-Contract Execution

- The `Balancer` contract constructor receives a Router address which is used to swap tokens (from ETH to tokens and vice versa). An interface called `IUniswapV2Router02` it's used for this purpose. 

## Inheritance and Interfaces

- `Balancer` contract inherits the OpenZeppelin `Ownable` contract to enable ownership for one managing user/party.

## Access Control Design Patterns

- `Ownable` design pattern used in three functions: `removeTenant()`, `withdraw()` and `addProperty()`. These functions do not need to be used by anyone else apart from the contract creator, i.e. the party that is responsible for managing the rental operations.