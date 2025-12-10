// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ExhibitionAMMTypes
 * @dev All struct and enum definitions for the Exhibition AMM
 */

/**
 * @dev Defines the structure for a liquidity pool in the AMM.
 */
struct LiquidityPool {
    address tokenA;          // Canonical (lower address) token
    address tokenB;          // Canonical (higher address) token
    uint256 reserveA;        // Amount of tokenA in pool
    uint256 reserveB;        // Amount of tokenB in pool
    uint256 totalLPSupply;   // Total LP shares for this pool
    uint256 kLast;           // Product of reserves for protocol fee
}

/**
 * @dev Liquidity lock information for launchpad projects
 */
struct LiquidityLock {
    uint256 projectId;       // Associated project ID
    address projectOwner;    // Project owner address
    uint256 unlockTime;      // Timestamp when unlock is possible
    uint256 lockedLPAmount;  // Amount of LP tokens locked
    bool isActive;           // Whether lock is active
}

/**
 * @dev Fee configuration structure
 */
struct FeeConfig {
    uint256 tradingFee;      // Trading fee in basis points (e.g., 30 = 0.3%)
    uint256 protocolFee;     // Protocol fee percentage of trading fee (e.g., 1667 = 16.67% of trading fee)
    address feeRecipient;    // Address to receive protocol fees
    bool feesEnabled;        // Whether fees are enabled
}

/**
 * @dev TWAP data structure
 */
struct TWAPData {
    uint256 price0CumulativeLast;
    uint256 price1CumulativeLast;
    uint32 blockTimestampLast;
}

/**
 * @dev User position tracking
 */
struct UserPosition {
    bool hasPosition;
    uint256 index;  // Index in user's pool arrays
}

/**
 * @dev Swap result structure
 */
struct SwapResult {
    uint256 amountOut;
    uint256 tradingFeeAmount;
    uint256 protocolFeeAmount;
}

/**
 * @dev Add liquidity result structure
 */
struct AddLiquidityResult {
    uint256 amountA;
    uint256 amountB;
    uint256 liquidity;
}

/**
 * @dev Remove liquidity result structure  
 */
struct RemoveLiquidityResult {
    uint256 amountA;
    uint256 amountB;
}