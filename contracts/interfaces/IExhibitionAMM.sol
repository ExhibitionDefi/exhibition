// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


// --- Structs ---
/**
 * @dev Defines the structure for a liquidity pool in the AMM.
 * Stores the reserves of the two tokens in the pool and the total LP supply for that specific pool.
 * @param tokenA Canonical (lower address) token in the pair.
 * @param tokenB Canonical (higher address) token in the pair.
 * @param reserveA Amount of tokenA currently held in the pool.
 * @param reserveB Amount of tokenB currently held in the pool.
 * @param totalLPSupply Total LP shares minted for this specific pool (cached from ExhibitionLPTokens).
 */
struct LiquidityPool {
    address tokenA;
    address tokenB;
    uint256 reserveA;
    uint256 reserveB;
    uint256 totalLPSupply;
}
// --- NEW: Liquidity Lock Struct ---
struct LiquidityLock {
    uint256 projectId;        // Associated project ID
    address projectOwner;     // Project owner who added the liquidity
    uint256 unlockTime;      // Timestamp when liquidity can be withdrawn
    uint256 lockedLPAmount;  // Amount of LP tokens locked
    bool isActive;           // Whether the lock is still active
}

/**
 * @title IExhibitionAMM
 * @dev Interface for the ExhibitionAMM contract with liquidity lock support
 */
interface IExhibitionAMM {

    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired,
        uint256 _amountAMin,
        uint256 _amountBMin,
        address _to,
        uint256 _deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _lpAmount,
        uint256 _amountAMin,
        uint256 _amountBMin,
        address _to,
        uint256 _deadline
    ) external returns (uint256 amountA, uint256 amountB);

    function swapTokenForToken(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _minAmountOut,
        address _to,
        uint256 _deadline
    ) external returns (uint256 amountOut);

    function getAmountOut(uint256 _amountIn, address _tokenIn, address _tokenOut) external view returns (uint256 amountOut);

    function exNEX_ADDRESS() external view returns (address);

    // --- NEW: Liquidity Lock Functions ---
    function addLiquidityWithLock(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired,
        uint256 _amountAMin,
        uint256 _amountBMin,
        address _to,
        uint256 _deadline,
        uint256 _projectId,
        uint256 _lockDuration
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function createLiquidityLock(
        uint256 _projectId,
        address _tokenA,
        address _tokenB,
        address _projectOwner,
        uint256 _lpAmount,
        uint256 _lockDuration
    ) external;

    function isLiquidityLocked(address _tokenA, address _tokenB, address _owner) external view returns (bool);

    function getWithdrawableLPAmount(address _tokenA, address _tokenB, address _owner) external view returns (uint256);

    function unlockLiquidity(address _tokenA, address _tokenB) external;

    function getOptimalLiquidityAmounts(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired
    ) external view returns (uint256 optimalAmountA, uint256 optimalAmountB);

    function getMultiplePoolInfo(address[][] calldata _tokenPairs) 
    external view returns (LiquidityPool[] memory pools);

    function getSlippageImpact(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external view returns (uint256 slippagePercentage);

    function getUserPortfolio(
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (
        address[] memory tokenAs,
        address[] memory tokenBs, 
        uint256[] memory lpBalances,
        uint256[] memory sharePercentages,
        uint256 totalPositions,
        bool hasMore
    );

    function getPoolStatistics(address _tokenA, address _tokenB) 
    external view returns (
        uint256 volume24h,
        uint256 tvl,
        uint256 utilization
    );

    function getTokensInfo(address[] calldata _tokens) external view returns (
        string[] memory symbols,
        uint8[] memory decimals,
        uint256[] memory totalSupplies
    );

    function getUserPositionCount(address _user) external view returns (uint256 count);

    function getUserBalancesForPools(
        address _user,
        address[][] calldata _tokenPairs
    ) external view returns (uint256[] memory balances);

    function getPoolsPaginated(
        uint256 _offset,
        uint256 _limit
    ) external view returns (
        address[] memory tokenAs,
        address[] memory tokenBs,
        uint256 totalPools,
        bool hasMore
    );

    function getUserPositionSummary(address _user) external view returns (
        uint256 positionCount,
        uint256 totalLPValue,
        uint256 activePoolCount
    );
}