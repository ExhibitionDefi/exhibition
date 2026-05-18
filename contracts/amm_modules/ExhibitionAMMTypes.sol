// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ExhibitionAMMTypes
 * @dev All struct and enum definitions for the Exhibition AMM
 */

struct LiquidityPool {
    address tokenA;
    address tokenB;
    uint256 reserveA;
    uint256 reserveB;
    uint256 totalLPSupply;
    uint256 kLast;
    uint256 inceptionBlock;

    // production-grade fee accounting
    uint256 accFeePerLP0; // tokenA fees per LP (scaled 1e18)
    uint256 accFeePerLP1; // tokenB fees per LP (scaled 1e18)
}

/**
 * @dev Liquidity lock information for launchpad projects
 */
struct LiquidityLock {
    uint256 projectId;       // Associated project ID
    address projectOwner;    // Project owner address
    uint256 unlockBlock;     // Block number when unlock is possible
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
    uint32  blockNumberLast;
    uint32  blocksAccumulated;
}

/**
 * @dev Per-user LP position for reward accounting.
 *
 * @param lpBalance   User's LP token balance.
 * @param feeDebt0    Snapshot of (lpBalance * accFeePerLP0) at last update.
 *                    Used to compute pending token0 rewards lazily.
 * @param feeDebt1    Snapshot of (lpBalance * accFeePerLP1) at last update.
 */
struct LPPosition {
    uint256 lpBalance;
    uint256 feeDebt0;
    uint256 feeDebt1;
}

/**
 * @dev Pool membership tracking — records whether a user has an active
 *      position in a pool and its index in the user's pool list.
 *      NOT related to earnings tracking; see LPPosition for that.
 */
struct UserPosition {
    bool hasPosition;
    uint256 index;
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