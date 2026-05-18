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
    address public USDXADDRESS;
    address public ExhTokenAddress;
    address public exhibitionContract;

    // ================================
    //       Fee Configuration
    // ================================
    
    FeeConfig public feeConfig;
    
    mapping(address => mapping(address => uint256)) public accumulatedProtocolFeesToken0;
    mapping(address => mapping(address => uint256)) public accumulatedProtocolFeesToken1;

    // ================================
    //       Pool Data
    // ================================
    
    mapping(address => mapping(address => LiquidityPool)) public liquidityPools;
    mapping(address => mapping(address => bool)) public poolExists;
    address[2][] public allPoolPairs;

    // ================================
    //       TWAP Data
    // ================================
    
    mapping(address => mapping(address => TWAPData)) public twapData;

    // ================================
    //       Liquidity Locks
    // ================================
    
    mapping(address => mapping(address => mapping(address => LiquidityLock))) public liquidityLocks;
    mapping(uint256 => address[2]) public projectTokenPairs;

    // ================================
    //       User Position Tracking
    // ================================
    
    mapping(address => address[]) public userPoolTokensA;
    mapping(address => address[]) public userPoolTokensB;
    mapping(address => mapping(address => mapping(address => bool))) public userHasPosition;

    // ================================
    //       Fee Tracking
    // ================================
    
    mapping(address => mapping(address => uint256)) public totalFeesCollected;
    mapping(address => mapping(address => uint256)) public totalFeesCollectedToken1;
    mapping(address => mapping(address => uint256)) public lastFeeUpdateBlock;

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
        address indexed tokenB,
        uint256 inceptionBlock
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
        uint256 unlockBlock
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

    // ================================
    //       Storage Gap
    // ================================
    
    uint256[50] private __gap;
}