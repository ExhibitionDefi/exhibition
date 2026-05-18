// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../amm_modules/ExhibitionAMMCore.sol";
import "../amm_modules/ExhibitionAMMViews.sol";
import "../libraries/IExhibitionAMM.sol";

/**
 * @title ExhibitionAMM
 * @dev Main AMM contract that inherits all modules
 * @notice Enhanced AMM with:
 * - Trading fees (configurable)
 * - Protocol fees (percentage of trading fees)
 * - Liquidity locks for launchpad projects
 * - Comprehensive view functions
 * - TWAP oracle support
 */
contract ExhibitionAMM is 
    Ownable, 
    ExhibitionAMMCore, 
    ExhibitionAMMViews,
    IExhibitionAMM 
{
    
    // ================================
    //       Constructor
    // ================================
    
    /**
     * @dev Initialize the AMM with default fee configuration
     * @param _tradingFeeBps Trading fee in basis points (e.g., 30 = 0.3%)
     * @param _protocolFeeBps Protocol fee as % of trading fee (e.g., 1600 = 16%)
     * @param _feeRecipient Address to receive protocol fees
     */
    constructor(
        uint256 _tradingFeeBps,
        uint256 _protocolFeeBps,
        address _feeRecipient
    ) Ownable(msg.sender) {
        _initializeFees(_tradingFeeBps, _protocolFeeBps, _feeRecipient);
    }

    // ================================
    //       Configuration Functions
    // ================================
    
    /**
     * @dev Set Exhibition contract address
     */
    function setExhibitionContract(address _exhibitionContract) external onlyOwner {
        if (_exhibitionContract == address(0)) revert ZeroAddress();
        
        address oldAddress = exhibitionContract;
        exhibitionContract = _exhibitionContract;
        emit ExhibitionContractSet(oldAddress, _exhibitionContract);
    }

    /**
     * @dev Set LP tokens contract address
     */
    function setLPTokensAddress(address _lpTokensAddress) external onlyOwner {
        if (_lpTokensAddress == address(0)) revert ZeroAddress();
        exhibitionLPTokens = IExhibitionLPTokens(_lpTokensAddress);
    }

    /**
     * @dev Set exNEX token address
     */
    function setExNEXAddress(address _exNEXAddress) external onlyOwner {
        if (_exNEXAddress == address(0)) revert ZeroAddress();
        _exNEXADDRESS = _exNEXAddress;
    }

    /**
     * @dev Set USDX token address
     */
    function setUSDXAddress(address _USDXAddress) external onlyOwner {
        if (_USDXAddress == address(0)) revert ZeroAddress();
        USDXADDRESS = _USDXAddress;
    }

    /**
     * @dev Set EXH token address
     */
    function setExhTokenAddress(address _exhTokenAddress) external onlyOwner {
        if (_exhTokenAddress == address(0)) revert ZeroAddress();
        ExhTokenAddress = _exhTokenAddress;
    }

    // ================================
    //       Fee Management
    // ================================
    
    /**
     * @dev Update fee configuration (owner only)
     */
    function setFeeConfig(
        uint256 _tradingFeeBps,
        uint256 _protocolFeeBps,
        address _feeRecipient
    ) external onlyOwner {
        _setFeeConfig(_tradingFeeBps, _protocolFeeBps, _feeRecipient);
    }

    /**
     * @dev Toggle fee collection
     */
    function setFeesEnabled(bool _enabled) external onlyOwner {
        _setFeesEnabled(_enabled);
    }

    /**
     * @dev Collect protocol fees for a specific pool
     */
    function collectProtocolFees(address _tokenA, address _tokenB) external onlyOwner {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        _collectProtocolFees(token0, token1);
    }

    /**
     * @dev Collect protocol fees from multiple pools
     */
    function collectProtocolFeesMultiple(address[][] calldata _tokenPairs) external onlyOwner {
        _collectProtocolFeesMultiple(_tokenPairs);
    }

    // ================================
    //       Liquidity Functions
    // ================================
    
    /**
     * @dev Add liquidity to a pool
     */
    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired,
        uint256 _amountAMin,
        uint256 _amountBMin,
        address _to,
        uint256 _deadline
    ) external nonReentrant returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        return _addLiquidity(
            _tokenA,
            _tokenB,
            _amountADesired,
            _amountBDesired,
            _amountAMin,
            _amountBMin,
            _to,
            _deadline
        );
    }

    /**
     * @dev Add liquidity with lock (called by Exhibition contract)
     */
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
    ) external override nonReentrant returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        // Only Exhibition contract can call this
        if (msg.sender != exhibitionContract) revert Unauthorized();
        
        // Add liquidity
        (amountA, amountB, liquidity) = _addLiquidity(
            _tokenA,
            _tokenB,
            _amountADesired,
            _amountBDesired,
            _amountAMin,
            _amountBMin,
            _to,
            _deadline
        );

        // Create lock if duration > 0
        if (_lockDuration > 0) {
            _createLiquidityLock(
                _projectId,
                _tokenA,
                _tokenB,
                _to,
                liquidity,
                _lockDuration
            );
        }

        return (amountA, amountB, liquidity);
    }

    /**
     * @dev Remove liquidity from a pool
     */
    function removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _lpAmount,
        uint256 _amountAMin,
        uint256 _amountBMin,
        address _to,
        uint256 _deadline
    ) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        return _removeLiquidity(
            _tokenA,
            _tokenB,
            _lpAmount,
            _amountAMin,
            _amountBMin,
            _to,
            _deadline
        );
    }

    function lockLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _lpAmount,
        uint256 _lockDurationBlocks
    ) external nonReentrant {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);

        if (!poolExists[token0][token1]) revert PoolDoesNotExist();
        if (_lpAmount == 0) revert ExhibitionAMMLibrary.ZeroAmount();

        // Verify caller actually holds enough LP tokens
        uint256 balance = exhibitionLPTokens.balanceOf(token0, token1, msg.sender);
        if (balance < _lpAmount) revert InsufficientLiquidity();

        _createPublicLock(_tokenA, _tokenB, msg.sender, _lpAmount, _lockDurationBlocks);
    } 

    // ================================
    //       Swap Functions
    // ================================
    
    /**
     * @dev Swap tokens
     */
    function swapTokenForToken(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _minAmountOut,
        address _to,
        uint256 _deadline
    ) external nonReentrant returns (uint256 amountOut) {
        return _swapTokenForToken(
            _tokenIn,
            _tokenOut,
            _amountIn,
            _minAmountOut,
            _to,
            _deadline
        );
    }

    // ================================
    //       Lock Management
    // ================================
    
    /**
     * @dev Create liquidity lock (called by Exhibition contract)
     */
    function createLiquidityLock(
        uint256 _projectId,
        address _tokenA,
        address _tokenB,
        address _projectOwner,
        uint256 _lpAmount,
        uint256 _lockDuration
    ) external {
        if (msg.sender != exhibitionContract) revert Unauthorized();
        _createLiquidityLock(_projectId, _tokenA, _tokenB, _projectOwner, _lpAmount, _lockDuration);
    }

    /**
     * @dev Unlock liquidity after lock period
     */
    function unlockLiquidity(address _tokenA, address _tokenB) external {
        _unlockLiquidity(_tokenA, _tokenB, msg.sender);
    }

    // ================================
    //       View Functions (Explicit Overrides)
    // ================================
    
    // Most view functions are inherited from ExhibitionAMMViews
    // Only explicit overrides needed for interface compliance

    function exNEXADDRESS() external view override returns (address) {
        return _exNEXADDRESS;
    }

    // ================================
    //       Receive/Fallback
    // ================================
    
    /**
     * @dev Reject direct NEX transfers
     */
    receive() external payable {
        revert("No NEX accepted");
    }

    fallback() external payable {
        revert("Invalid function call");
    }
}