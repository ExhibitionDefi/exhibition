// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ExhibitionAMMErrors
 * @dev Shared error definitions for AMM contracts
 */
abstract contract ExhibitionAMMErrors {
    error ZeroAddress();
    error ZeroAmount();
    error Unauthorized();
    error TokenTransferFailed();
    error InvalidFeeConfiguration();
    error NoFeesToCollect();
    error LiquidityIsLocked();
    error InvalidLockData();
}