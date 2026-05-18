// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionAMMStorage.sol";
import "./ExhibitionAMMLibrary.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title ExhibitionAMMEarnings
 * @dev Module for tracking and calculating LP earnings.
 *
 *  Core design (accFeePerLP model):
 *
 *  1. Global fee accounting
 *     - Each pool tracks:
 *         • accFeePerLP0
 *         • accFeePerLP1
 *       representing cumulative fees earned per LP token
 *       (scaled to 1e18 for precision).
 *
 *  2. User checkpointing (feeDebt)
 *     - Each user stores:
 *         • feeDebt0
 *         • feeDebt1
 *       which represent the last accounted share of accumulated fees.
 *
 *     - Pending rewards are calculated as:
 *
 *         pending = (lpBalance * accFeePerLP) - feeDebt
 *
 *  3. Reward settlement (lazy evaluation)
 *     - `_updateRewards` is called on:
 *         • liquidity add
 *         • liquidity removal
 *
 *     - This:
 *         • settles pending rewards into cumulative earnings
 *         • updates feeDebt to the latest baseline
 *
 *  4. Fee distribution (swap-driven)
 *     - On every swap:
 *         • LP fees are distributed via `_updatePoolFees`
 *         • This increases `accFeePerLP` proportionally
 *
 *  5. Precision handling
 *     - Token amounts are normalized to 18 decimals where needed
 *       to ensure consistent cross-token calculations.
 *
 *  6. Design properties
 *     - O(1) per user interaction (no loops, no arrays)
 *     - No historical snapshots or cost-basis tracking
 *     - Gas-efficient and scalable for large LP sets
 *     - Deterministic and manipulation-resistant reward model
 */
abstract contract ExhibitionAMMEarnings is ExhibitionAMMStorage {

    // ================================
    //       Storage
    // ================================

    // user → token0 → token1 → position
    mapping(address => mapping(address => mapping(address => LPPosition))) public lpPositions;

    // Cumulative realised earnings (updated on each withdrawal)
    mapping(address => mapping(address => mapping(address => uint256))) public cumulativeEarningsToken0;
    mapping(address => mapping(address => mapping(address => uint256))) public cumulativeEarningsToken1;

    // ================================
    //       Events
    // ================================

    event PositionUpdated(
        address indexed user,
        address indexed token0,
        address indexed token1,
        uint256 lpBalance,
        uint256 feeDebt0,
        uint256 feeDebt1
    );

    event EarningsRealized(
        address indexed user,
        address indexed token0,
        address indexed token1,
        uint256 earningsA,
        uint256 earningsB
    );

    // ================================
    //       View: Unrealised Earnings
    // ================================

    /**
     * @notice Calculate unrealized (pending) fee earnings for a user.
     * @dev    Based purely on accFeePerLP model. Does NOT include
     *         impermanent gain/loss or price-based PnL.
     */
    function calculateUnrealizedEarnings(
        address _user,
        address _tokenA,
        address _tokenB
    ) public view returns (
        uint256 pending0,
        uint256 pending1
    ) {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        if (!poolExists[token0][token1]) return (0, 0);

       LPPosition storage pos = lpPositions[_user][token0][token1];
       if (pos.lpBalance == 0) return (0, 0);

       LiquidityPool storage pool = liquidityPools[token0][token1];

       uint256 accumulated0 = (pos.lpBalance * pool.accFeePerLP0) / 1e18;
       uint256 accumulated1 = (pos.lpBalance * pool.accFeePerLP1) / 1e18;

        if (accumulated0 > pos.feeDebt0) {
           pending0 = accumulated0 - pos.feeDebt0;
        }

        if (accumulated1 > pos.feeDebt1) {
            pending1 = accumulated1 - pos.feeDebt1;
        }
    }

    // ================================
    //       View: Realised Earnings
    // ================================

    /**
     * @notice Returns a user's earnings for a given pool.
     *
     * @dev
     * - settled0 / settled1:
     *     Total realised (checkpointed) earnings accumulated via `_updateRewards`.
     *
     * - pending0 / pending1:
     *     Unclaimed (floating) earnings based on current `accFeePerLP`
     *     minus the user's `feeDebt`.
     *
     * Earnings are derived purely from swap fees distributed via the
     * `accFeePerLP` model. No price-based PnL or impermanent loss is included.
     */
    function getRealizedEarnings(
        address _user,
        address _tokenA,
        address _tokenB
    ) public view returns (
        uint256 settled0, 
        uint256 settled1, 
        uint256 pending0, 
        uint256 pending1
    ) {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        
        // 1. Settled: Stored in the mapping from previous _updateRewards calls
        settled0 = cumulativeEarningsToken0[_user][token0][token1];
        settled1 = cumulativeEarningsToken1[_user][token0][token1];

        // 2. Pending: Floating rewards based on current accFeePerLP
        LPPosition storage pos = lpPositions[_user][token0][token1];
        if (pos.lpBalance > 0) {
            LiquidityPool storage pool = liquidityPools[token0][token1];
            
            uint256 accumulated0 = (pos.lpBalance * pool.accFeePerLP0) / 1e18;
            uint256 accumulated1 = (pos.lpBalance * pool.accFeePerLP1) / 1e18;

            if (accumulated0 > pos.feeDebt0) pending0 = accumulated0 - pos.feeDebt0;
            if (accumulated1 > pos.feeDebt1) pending1 = accumulated1 - pos.feeDebt1;
        }
    }

    // ================================
    //       View: Full Report
    // ================================

    /**
     * @notice Comprehensive fee earnings report for a user in a pool.
     *
     * @dev
     * Returns:
     * - settled:   earnings already checkpointed via `_updateRewards`
     * - pending:   unclaimed earnings based on current `accFeePerLP`
     * - total:     sum of settled + pending
     *
     * Earnings are derived purely from swap fees. No PnL, APY, or
     * impermanent loss calculations are included.
     */
    function getEarningsReport(
        address _user,
        address _tokenA,
        address _tokenB
    ) external view returns (
        uint256 settled0,
        uint256 settled1,
        uint256 pending0,
        uint256 pending1,
        uint256 total0,
        uint256 total1
    ) {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);

        // --- Settled + Pending ---
        (settled0, settled1, pending0, pending1) =
            getRealizedEarnings(_user, token0, token1);

        // --- Total ---
        total0 = settled0 + pending0;
        total1 = settled1 + pending1;
    }

    
    /**
     * @notice Settle and checkpoint a user's accumulated LP fees.
     * @dev Must be called before any change to the user's LP balance.
     *
     *  • Computes total accumulated fees for the user's position:
     *
     *        accumulated = (lpBalance * accFeePerLP) / 1e18
     *
     *  • Pending rewards are:
     *
     *        pending = accumulated - feeDebt
     *
     *  • If pending > 0:
     *        - Added to cumulative earnings storage
     *        - Emits `EarningsRealized`
     *
     *  • After settlement:
     *        - `feeDebt` is updated to match current accumulated value
     *
     *  This ensures:
     *      - Users receive all fees earned up to this point
     *      - Future rewards are calculated from a clean baseline
     *
     *  Key properties:
     *      - O(1) operation (no loops)
     *      - Lazy evaluation (no per-block updates required)
     *      - Prevents double-counting of rewards
     *
     *  Requirements:
     *      - Must be called BEFORE:
     *          • adding liquidity
     *          • removing liquidity
     */
    function _updateRewards(
        address user,
        address token0,
        address token1
    ) internal {
        LPPosition storage pos = lpPositions[user][token0][token1];
        LiquidityPool storage pool = liquidityPools[token0][token1];

        if (pos.lpBalance > 0) {
            // Calculate total accumulated fees for this position's balance
            uint256 accumulated0 = (pos.lpBalance * pool.accFeePerLP0) / 1e18;
            uint256 accumulated1 = (pos.lpBalance * pool.accFeePerLP1) / 1e18;

            // Pending is what was earned since the last update
            uint256 pending0 = accumulated0 > pos.feeDebt0 ? accumulated0 - pos.feeDebt0 : 0;
            uint256 pending1 = accumulated1 > pos.feeDebt1 ? accumulated1 - pos.feeDebt1 : 0;

            if (pending0 > 0 || pending1 > 0) {
                cumulativeEarningsToken0[user][token0][token1] += pending0;
                cumulativeEarningsToken1[user][token0][token1] += pending1;

                emit EarningsRealized(user, token0, token1, pending0, pending1);
            }
        }

        // IMPORTANT: Always reset feeDebt to the current total accumulation 
        // to "checkpoint" the rewards, even if balance is 0 or pending is 0.
        pos.feeDebt0 = (pos.lpBalance * pool.accFeePerLP0) / 1e18;
        pos.feeDebt1 = (pos.lpBalance * pool.accFeePerLP1) / 1e18;
    }

    function _accrueFees(
        address token0,
        address token1,
        address tokenIn,
        uint256 lpFee
    ) internal {
        LiquidityPool storage pool = liquidityPools[token0][token1];

        if (pool.totalLPSupply == 0) return;

        if (tokenIn == token0) {
            pool.accFeePerLP0 += (lpFee * 1e18) / pool.totalLPSupply;
        } else {
            pool.accFeePerLP1 += (lpFee * 1e18) / pool.totalLPSupply;
        }
    }


    // ================================
    //       View: Raw Position
    // ================================

    /**
     * @notice Return the raw LPPosition struct for a user / pool.
     */
    function getUserPosition(
        address _user,
        address _tokenA,
        address _tokenB
    ) external view returns (LPPosition memory) {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        return lpPositions[_user][token0][token1];
    }
}