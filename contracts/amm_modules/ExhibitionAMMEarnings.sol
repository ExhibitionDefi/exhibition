// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionAMMStorage.sol";
import "./ExhibitionAMMLibrary.sol";

/**
 * @title ExhibitionAMMEarnings
 * @dev Module for tracking and calculating LP earnings
 */
abstract contract ExhibitionAMMEarnings is ExhibitionAMMStorage {
    
    // ================================
    //       Earnings Tracking
    // ================================
    
    // Snapshot of pool state when user adds liquidity
    struct LPSnapshot {
        uint256 reserveA;           // Pool reserveA at deposit time
        uint256 reserveB;           // Pool reserveB at deposit time
        uint256 lpAmount;           // LP tokens user received
        uint256 timestamp;          // When liquidity was added
        uint256 totalLPSupply;      // Total LP supply at deposit time
    }
    
    // User → TokenA → TokenB → Snapshot history
    mapping(address => mapping(address => mapping(address => LPSnapshot[]))) public lpSnapshots;
    
    // Track cumulative earnings per user per pool
    mapping(address => mapping(address => mapping(address => uint256))) public cumulativeEarningsToken0;
    mapping(address => mapping(address => mapping(address => uint256))) public cumulativeEarningsToken1;
    
    // Events
    event EarningsSnapshot(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        uint256 lpAmount,
        uint256 reserveA,
        uint256 reserveB
    );
    
    event EarningsRealized(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        uint256 earningsA,
        uint256 earningsB
    );

    // ================================
    //       Snapshot Management
    // ================================
    
    /**
     * @dev Record snapshot when user adds liquidity
     */
    function _recordLPSnapshot(
        address _user,
        address _tokenA,
        address _tokenB,
        uint256 _lpAmount
    ) internal {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        LiquidityPool storage pool = liquidityPools[token0][token1];
        
        lpSnapshots[_user][token0][token1].push(LPSnapshot({
            reserveA: pool.reserveA,
            reserveB: pool.reserveB,
            lpAmount: _lpAmount,
            timestamp: block.timestamp,
            totalLPSupply: pool.totalLPSupply
        }));
        
        emit EarningsSnapshot(_user, token0, token1, _lpAmount, pool.reserveA, pool.reserveB);
    }
    
    /**
     * @dev Update cumulative earnings when user removes liquidity
     */
    function _updateCumulativeEarnings(
        address _user,
        address _tokenA,
        address _tokenB,
        uint256 _lpAmountRemoved
    ) internal {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        
        // Calculate earnings for this withdrawal
        (uint256 earningsA, uint256 earningsB) = _calculateEarningsForWithdrawal(
            _user,
            token0,
            token1,
            _lpAmountRemoved
        );
        
        // Add to cumulative
        cumulativeEarningsToken0[_user][token0][token1] += earningsA;
        cumulativeEarningsToken1[_user][token0][token1] += earningsB;
        
        emit EarningsRealized(_user, token0, token1, earningsA, earningsB);
    }

    // ================================
    //       Earnings Calculations
    // ================================
    
    /**
     * @dev Calculate current unrealized earnings for a user
     * @return earningsA Earnings in tokenA
     * @return earningsB Earnings in tokenB
     * @return valueAtDeposit Original value deposited
     * @return currentValue Current value of LP position
     * @return apy Estimated APY (basis points)
     */
    function calculateUnrealizedEarnings(
        address _user,
        address _tokenA,
        address _tokenB
    ) public view returns (
        uint256 earningsA,
        uint256 earningsB,
        uint256 valueAtDeposit,
        uint256 currentValue,
        uint256 apy
    ) {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        
        if (!poolExists[token0][token1]) {
            return (0, 0, 0, 0, 0);
        }
        
        uint256 currentLPBalance = exhibitionLPTokens.balanceOf(token0, token1, _user);
        if (currentLPBalance == 0) {
            return (0, 0, 0, 0, 0);
        }
        
        LiquidityPool storage pool = liquidityPools[token0][token1];
        LPSnapshot[] storage snapshots = lpSnapshots[_user][token0][token1];
        
        if (snapshots.length == 0) {
            // No snapshot - calculate based on current position only
            uint256 amountA = (currentLPBalance * pool.reserveA) / pool.totalLPSupply;
            uint256 amountB = (currentLPBalance * pool.reserveB) / pool.totalLPSupply;
            
            return (0, 0, 0, amountA + amountB, 0);
        }
        
        // Calculate weighted average of all snapshots
        uint256 totalDepositedA;
        uint256 totalDepositedB;
        uint256 totalLPFromSnapshots;
        uint256 oldestTimestamp = block.timestamp;
        
        for (uint256 i = 0; i < snapshots.length; i++) {
            LPSnapshot memory snap = snapshots[i];
            
            // Original amounts deposited
            uint256 depositedA = (snap.lpAmount * snap.reserveA) / snap.totalLPSupply;
            uint256 depositedB = (snap.lpAmount * snap.reserveB) / snap.totalLPSupply;
            
            totalDepositedA += depositedA;
            totalDepositedB += depositedB;
            totalLPFromSnapshots += snap.lpAmount;
            
            if (snap.timestamp < oldestTimestamp) {
                oldestTimestamp = snap.timestamp;
            }
        }
        
        // Current value of LP tokens
        uint256 currentAmountA = (currentLPBalance * pool.reserveA) / pool.totalLPSupply;
        uint256 currentAmountB = (currentLPBalance * pool.reserveB) / pool.totalLPSupply;
        
        // Calculate earnings
        earningsA = currentAmountA > totalDepositedA ? currentAmountA - totalDepositedA : 0;
        earningsB = currentAmountB > totalDepositedB ? currentAmountB - totalDepositedB : 0;
        
        valueAtDeposit = totalDepositedA + totalDepositedB;
        currentValue = currentAmountA + currentAmountB;
        
        // Calculate APY
        if (valueAtDeposit > 0 && oldestTimestamp < block.timestamp) {
            uint256 timeElapsed = block.timestamp - oldestTimestamp;
            uint256 profit = currentValue > valueAtDeposit ? currentValue - valueAtDeposit : 0;
            
            if (timeElapsed > 0 && profit > 0) {
                // APY = (profit / valueAtDeposit) * (365 days / timeElapsed) * 10000
                apy = (profit * 365 days * 10000) / (valueAtDeposit * timeElapsed);
            }
        }
        
        return (earningsA, earningsB, valueAtDeposit, currentValue, apy);
    }
    
    /**
     * @dev Calculate earnings for a specific withdrawal amount
     */
    function _calculateEarningsForWithdrawal(
        address _user,
        address _token0,
        address _token1,
        uint256 _lpAmountRemoved
    ) internal view returns (uint256 earningsA, uint256 earningsB) {
        LiquidityPool storage pool = liquidityPools[_token0][_token1];
        LPSnapshot[] storage snapshots = lpSnapshots[_user][_token0][_token1];
        
        if (snapshots.length == 0) {
            return (0, 0);
        }
        
        // Current value being withdrawn
        uint256 currentAmountA = (_lpAmountRemoved * pool.reserveA) / pool.totalLPSupply;
        uint256 currentAmountB = (_lpAmountRemoved * pool.reserveB) / pool.totalLPSupply;
        
        // Calculate proportional original deposit (FIFO basis)
        uint256 remainingLP = _lpAmountRemoved;
        uint256 originalAmountA;
        uint256 originalAmountB;
        
        for (uint256 i = 0; i < snapshots.length && remainingLP > 0; i++) {
            LPSnapshot memory snap = snapshots[i];
            uint256 lpToUse = remainingLP > snap.lpAmount ? snap.lpAmount : remainingLP;
            
            originalAmountA += (lpToUse * snap.reserveA) / snap.totalLPSupply;
            originalAmountB += (lpToUse * snap.reserveB) / snap.totalLPSupply;
            
            remainingLP -= lpToUse;
        }
        
        // Calculate earnings
        earningsA = currentAmountA > originalAmountA ? currentAmountA - originalAmountA : 0;
        earningsB = currentAmountB > originalAmountB ? currentAmountB - originalAmountB : 0;
    }
    
    /**
     * @dev Get total realized earnings (from past withdrawals)
     */
    function getRealizedEarnings(
        address _user,
        address _tokenA,
        address _tokenB
    ) public view returns (uint256 realizedA, uint256 realizedB) {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        
        realizedA = cumulativeEarningsToken0[_user][token0][token1];
        realizedB = cumulativeEarningsToken1[_user][token0][token1];
    }
    
    /**
     * @dev Get comprehensive earnings report for a user
     */
    function getEarningsReport(
        address _user,
        address _tokenA,
        address _tokenB
    ) external view returns (
        uint256 unrealizedEarningsA,
        uint256 unrealizedEarningsB,
        uint256 realizedEarningsA,
        uint256 realizedEarningsB,
        uint256 totalEarningsA,
        uint256 totalEarningsB,
        uint256 currentValue,
        uint256 originalDeposit,
        uint256 apy,
        uint256 daysActive
    ) {
        // Get unrealized earnings
        (
            unrealizedEarningsA,
            unrealizedEarningsB,
            originalDeposit,
            currentValue,
            apy
        ) = calculateUnrealizedEarnings(_user, _tokenA, _tokenB);
        
        // Get realized earnings
        (realizedEarningsA, realizedEarningsB) = getRealizedEarnings(_user, _tokenA, _tokenB);
        
        // Calculate totals
        totalEarningsA = unrealizedEarningsA + realizedEarningsA;
        totalEarningsB = unrealizedEarningsB + realizedEarningsB;
        
        // Calculate days active
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        LPSnapshot[] storage snapshots = lpSnapshots[_user][token0][token1];
        
        if (snapshots.length > 0) {
            uint256 oldestTimestamp = snapshots[0].timestamp;
            for (uint256 i = 1; i < snapshots.length; i++) {
                if (snapshots[i].timestamp < oldestTimestamp) {
                    oldestTimestamp = snapshots[i].timestamp;
                }
            }
            daysActive = (block.timestamp - oldestTimestamp) / 1 days;
        }
    }
    
    /**
     * @dev Get earnings for multiple pools (portfolio view)
     */
    function getPortfolioEarnings(
        address _user,
        address[][] calldata _tokenPairs
    ) external view returns (
        uint256[] memory unrealizedEarningsA,
        uint256[] memory unrealizedEarningsB,
        uint256[] memory realizedEarningsA,
        uint256[] memory realizedEarningsB,
        uint256[] memory apys
    ) {
        uint256 length = _tokenPairs.length;
        
        unrealizedEarningsA = new uint256[](length);
        unrealizedEarningsB = new uint256[](length);
        realizedEarningsA = new uint256[](length);
        realizedEarningsB = new uint256[](length);
        apys = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            require(_tokenPairs[i].length == 2, "Invalid pair");
            
            (
                unrealizedEarningsA[i],
                unrealizedEarningsB[i],
                ,
                ,
                apys[i]
            ) = calculateUnrealizedEarnings(_user, _tokenPairs[i][0], _tokenPairs[i][1]);
            
            (
                realizedEarningsA[i],
                realizedEarningsB[i]
            ) = getRealizedEarnings(_user, _tokenPairs[i][0], _tokenPairs[i][1]);
        }
    }
    
    /**
     * @dev Calculate estimated daily earnings based on recent fees
     */
    function estimateDailyEarnings(
        address _user,
        address _tokenA,
        address _tokenB
    ) external view returns (uint256 dailyEarningsA, uint256 dailyEarningsB) {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        
        if (!poolExists[token0][token1]) {
            return (0, 0);
        }
        
        uint256 userLPBalance = exhibitionLPTokens.balanceOf(token0, token1, _user);
        if (userLPBalance == 0) {
            return (0, 0);
        }
        
        LiquidityPool storage pool = liquidityPools[token0][token1];
        
        // User's share of the pool
        uint256 userShare = (userLPBalance * 10000) / pool.totalLPSupply; // in basis points
        
        // Estimate based on last 24h fees (simplified - would need event tracking for accuracy)
        uint256 last24hFees = totalFeesCollected[token0][token1]; // This is cumulative, needs improvement
        
        // Rough estimate: user gets their share of LP fees (83.33% of trading fees)
        dailyEarningsA = (last24hFees * userShare * 8333) / (10000 * 10000); // Simplified
        dailyEarningsB = dailyEarningsA; // Assumes balanced pool
    }
    
    /**
     * @dev Get user's snapshot history
     */
    function getUserSnapshots(
        address _user,
        address _tokenA,
        address _tokenB
    ) external view returns (LPSnapshot[] memory) {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        return lpSnapshots[_user][token0][token1];
    }
}