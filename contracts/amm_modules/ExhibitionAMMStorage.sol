// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionAMMTypes.sol";
import "../libraries/IExhibitionLPTokens.sol";

/**
 * @title ExhibitionAMMStorage
 * @dev Centralized storage for the Exhibition AMM
 */
abstract contract ExhibitionAMMStorage {
    
    // ================================
    //       Core Addresses
    // ================================
    
    IExhibitionLPTokens public exhibitionLPTokens;
    address internal _exNEXADDRESS;
    address public exUSDADDRESS;
    address public ExhTokenAddress;
    address public exhibitionContract;

    // ================================
    //       Fee Configuration
    // ================================
    
    FeeConfig public feeConfig;
    
    // Track accumulated protocol fees per pool
    mapping(address => mapping(address => uint256)) public accumulatedProtocolFeesToken0;
    mapping(address => mapping(address => uint256)) public accumulatedProtocolFeesToken1;

    // ================================
    //       Pool Data
    // ================================
    
    // Main pool storage: token0 => token1 => LiquidityPool
    mapping(address => mapping(address => LiquidityPool)) public liquidityPools;
    
    // Pool existence tracking
    mapping(address => mapping(address => bool)) public poolExists;
    
    // Array of all pool pairs (alternating token0, token1)
    address[] public allPoolPairs;

    // ================================
    //       TWAP Data
    // ================================
    
    mapping(address => mapping(address => TWAPData)) public twapData;

    // ================================
    //       Liquidity Locks
    // ================================
    
    // Liquidity locks: token0 => token1 => owner => LiquidityLock
    mapping(address => mapping(address => mapping(address => LiquidityLock))) public liquidityLocks;
    
    // Project ID to token pair mapping
    mapping(uint256 => address[2]) public projectTokenPairs;

    // ================================
    //       User Position Tracking
    // ================================
    
    // User's pools: user => array of tokenA addresses
    mapping(address => address[]) public userPoolTokensA;
    
    // User's pools: user => array of tokenB addresses
    mapping(address => address[]) public userPoolTokensB;
    
    // Check if user has position: tokenA => tokenB => user => bool
    mapping(address => mapping(address => mapping(address => bool))) public userHasPosition;

    // ================================
    //       Fee Tracking (Optional)
    // ================================
    
    // Total fees collected per pool
    mapping(address => mapping(address => uint256)) public totalFeesCollected;
    
    // Last fee update timestamp
    mapping(address => mapping(address => uint256)) public lastFeeUpdateTime;

    // ================================
    //       Events
    // ================================
    
    event LiquidityAdded(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityMinted
    );
    
    event LiquidityRemoved(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB
    );
    
    event Swap(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 tradingFee,
        uint256 protocolFee
    );
    
    event PoolCreated(
        address indexed tokenA, 
        address indexed tokenB
    );
    
    event ReservesUpdated(
        address indexed token0, 
        address indexed token1, 
        uint256 reserve0, 
        uint256 reserve1
    );
    
    event LiquidityLocked(
        uint256 indexed projectId,
        address indexed tokenA,
        address indexed tokenB,
        address projectOwner,
        uint256 lpAmount,
        uint256 unlockTime
    );
    
    event LiquidityUnlocked(
        uint256 indexed projectId,
        address indexed tokenA,
        address indexed tokenB,
        address projectOwner,
        uint256 lpAmount
    );
    
    event ExhibitionContractSet(
        address indexed oldAddress, 
        address indexed newAddress
    );
    
    event FeeConfigUpdated(
        uint256 tradingFee,
        uint256 protocolFee,
        address feeRecipient
    );
    
    event ProtocolFeesCollected(
        address indexed token0,
        address indexed token1,
        uint256 amount0,
        uint256 amount1,
        address indexed recipient
    );
    
    event EmergencyWithdrawal(
        address indexed token, 
        uint256 amount, 
        address indexed recipient
    );

    // ================================
    //       Storage Gap
    // ================================
    
    // Reserved storage space for future upgrades
    uint256[50] private __gap;
}