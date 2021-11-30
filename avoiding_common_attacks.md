# Contract security measures

## SWC-103 (Floating pragma)

Specific compiler pragma `0.8.6` used in `Balancer` contract to avoid accidental bug inclusion through outdated compiler versions.

## SWC-105 (Unprotected Ether Withdrawal)

`withdraw` is protected by checking that the balance amount doesn't exceed the sender balance in the contract

## SWC-135 Code With No Effects

There are a good amount of unit tests that verify correct behaviour of the smart contract code.

## Modifiers used only for validation

All modifiers in `Balancer` contract only validate data with `require` statements.