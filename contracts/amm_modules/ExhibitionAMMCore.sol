// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ExhibitionAMMStorage.sol";
import "./ExhibitionAMMLibrary.sol";
import "./ExhibitionAMMFees.sol";
import "./ExhibitionAMMLocks.sol";
import "./ExhibitionAMMEarnings.sol";
import "../libraries/IExhibitionMinimal.sol";  // ✨ Use minimal interface

/**
 * @title ExhibitionAMMCore
 * @dev Core AMM logic - liquidity and swap functions
 */
abstract contract ExhibitionAMMCore is 
    ExhibitionAMMStorage, 
    ExhibitionAMMFees, 
    ExhibitionAMMLocks,
    ExhibitionAMMEarnings,
    ReentrancyGuard 
{
    
    // ================================
    //       Error Definitions
    // ================================
    
    error InvalidAmount();
    error InsufficientLiquidity();
    error SlippageTooHigh();
    error DeadlineExpired();
    error PoolDoesNotExist();
    error PoolAlreadyExists();
    error ZeroLiquidity();
    error InvalidTokenAddress();
    error InvalidRecipient();
    error UnauthorizedPoolCreation();

    // ================================
    //       Internal Helpers
    // ================================
    
    /**
     * @dev Transfer tokens safely
     */
    function _transferTokens(
        address _token, 
        address _from, 
        address _to, 
        uint256 _amount
    ) internal {
        if (_amount == 0) revert ExhibitionAMMLibrary.ZeroAmount();
        if (_to == address(0)) revert InvalidRecipient();

        if (_from == address(this)) {
            bool success = IERC20(_token).transfer(_to, _amount);
            if (!success) revert TokenTransferFailed();
        } else {
            bool success = IERC20(_token).transferFrom(_from, _to, _amount);
            if (!success) revert TokenTransferFailed();
        }
    }

    /**
     * @dev Mint LP tokens
     */
    function _mintLiquidity(
        address _tokenA, 
        address _tokenB, 
        address _to, 
        uint256 _amount
    ) internal {
        if (address(exhibitionLPTokens) == address(0)) revert Unauthorized();
        if (_amount == 0) revert ExhibitionAMMLibrary.ZeroAmount();

        // Track user position
        if (!userHasPosition[_tokenA][_tokenB][_to]) {
            userPoolTokensA[_to].push(_tokenA);
            userPoolTokensB[_to].push(_tokenB);
            userHasPosition[_tokenA][_tokenB][_to] = true;
        }

        exhibitionLPTokens.mint(_tokenA, _tokenB, _to, _amount);
        liquidityPools[_tokenA][_tokenB].totalLPSupply += _amount;
    }

    /**
     * @dev Burn LP tokens
     */
    function _burnLiquidity(
        address _tokenA, 
        address _tokenB, 
        address _from, 
        uint256 _amount
    ) internal {
        if (address(exhibitionLPTokens) == address(0)) revert Unauthorized();
        if (_amount == 0) revert ExhibitionAMMLibrary.ZeroAmount();

        exhibitionLPTokens.burn(_tokenA, _tokenB, _from, _amount);
        liquidityPools[_tokenA][_tokenB].totalLPSupply -= _amount;
    }

    /**
     * @dev Update pool reserves and TWAP
     */
    function _updateReserves(
        address _token0, 
        address _token1, 
        uint256 _newReserve0, 
        uint256 _newReserve1
    ) internal {
        LiquidityPool storage pool = liquidityPools[_token0][_token1];
        TWAPData storage twap = twapData[_token0][_token1];

        // TWAP update
        uint32 blockTimestamp = uint32(block.timestamp);
        uint32 timeElapsed = blockTimestamp - twap.blockTimestampLast;

        if (timeElapsed > 0 && pool.reserveA != 0 && pool.reserveB != 0) {
            twap.price0CumulativeLast += ExhibitionAMMLibrary.mulDiv(
                pool.reserveB, 
                timeElapsed, 
                pool.reserveA
            );
            twap.price1CumulativeLast += ExhibitionAMMLibrary.mulDiv(
                pool.reserveA, 
                timeElapsed, 
                pool.reserveB
            );
        }
        twap.blockTimestampLast = blockTimestamp;

        // Update reserves
        pool.reserveA = _newReserve0;
        pool.reserveB = _newReserve1;
        pool.kLast = _newReserve0 * _newReserve1;

        emit ReservesUpdated(_token0, _token1, _newReserve0, _newReserve1);
    }

    /**
     * @dev Get reserves for a token pair
     */
    function _getReserves(address _tokenA, address _tokenB) 
        internal 
        view 
        returns (uint256 reserveA, uint256 reserveB) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);

        if (!poolExists[token0][token1]) revert PoolDoesNotExist();

        LiquidityPool storage pool = liquidityPools[token0][token1];

        if (_tokenA == token0) {
            reserveA = pool.reserveA;
            reserveB = pool.reserveB;
        } else {
            reserveA = pool.reserveB;
            reserveB = pool.reserveA;
        }
    }

    // ================================
    //       Add Liquidity
    // ================================
    
    /**
     * @dev Add liquidity to a pool
     */
    function _addLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired,
        uint256 _amountAMin,
        uint256 _amountBMin,
        address _to,
        uint256 _deadline
    ) internal returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        if (block.timestamp >= _deadline) revert DeadlineExpired();
        if (_to == address(0)) revert InvalidRecipient();

        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);

        if (!poolExists[token0][token1]) {
            // Create new pool
            _createPool(token0, token1);
        
            if (_amountADesired == 0 || _amountBDesired == 0) revert InvalidAmount();

            amountA = _amountADesired;
            amountB = _amountBDesired;
            liquidity = ExhibitionAMMLibrary.sqrt(amountA * amountB);
        
            if (liquidity == 0) revert ZeroLiquidity();
        } else {
            // Add to existing pool
            (uint256 reserveA, uint256 reserveB) = _getReserves(_tokenA, _tokenB);

            (amountA, amountB) = ExhibitionAMMLibrary.calculateOptimalAmounts(
                _amountADesired,
                _amountBDesired,
                reserveA,
                reserveB
            );

            if (amountA < _amountAMin || amountB < _amountBMin) revert SlippageTooHigh();

            uint256 totalSupply = liquidityPools[token0][token1].totalLPSupply;
            liquidity = ExhibitionAMMLibrary.calculateLiquidity(
                amountA,
                amountB,
                reserveA,
                reserveB,
                totalSupply
            );

            if (liquidity == 0) revert ZeroLiquidity();
        }

        // Transfer tokens
        _transferTokens(_tokenA, msg.sender, address(this), amountA);
        _transferTokens(_tokenB, msg.sender, address(this), amountB);

        // Update reserves - get fresh reserves after transfers
        (uint256 newReserveA, uint256 newReserveB) = _getReserves(_tokenA, _tokenB);  // <-- RENAMED variables
        uint256 newReserve0 = (_tokenA == token0) ? (newReserveA + amountA) : (newReserveB + amountB);
        uint256 newReserve1 = (_tokenA == token0) ? (newReserveB + amountB) : (newReserveA + amountA);

        _updateReserves(token0, token1, newReserve0, newReserve1);
        _mintLiquidity(token0, token1, _to, liquidity);

        emit LiquidityAdded(msg.sender, _tokenA, _tokenB, amountA, amountB, liquidity);
    }

    /**
     * @dev Create a new pool
     */
    function _createPool(address token0, address token1) internal {
        if (exhibitionContract != address(0)) {
            bool token0IsProject = IExhibitionMinimal(exhibitionContract).isProjectToken(token0);
            bool token1IsProject = IExhibitionMinimal(exhibitionContract).isProjectToken(token1);

            if (token0IsProject || token1IsProject) {
                if (msg.sender != exhibitionContract) {
                    revert UnauthorizedPoolCreation();
                }
            }
        }
        poolExists[token0][token1] = true;
        liquidityPools[token0][token1].tokenA = token0;
        liquidityPools[token0][token1].tokenB = token1;
        allPoolPairs.push(token0);
        allPoolPairs.push(token1);
        
        emit PoolCreated(token0, token1);
    }

    // ================================
    //       Remove Liquidity
    // ================================
    
    /**
     * @dev Remove liquidity from a pool
     */
    function _removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _lpAmount,
        uint256 _amountAMin,
        uint256 _amountBMin,
        address _to,
        uint256 _deadline
    ) internal returns (uint256 amountA, uint256 amountB) {
        if (block.timestamp >= _deadline) revert DeadlineExpired();
        if (_to == address(0)) revert InvalidRecipient();
        if (_lpAmount == 0) revert ZeroLiquidity();

        // Check liquidity lock
        _checkLiquidityLock(_tokenA, _tokenB, msg.sender, _lpAmount);

        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        if (!poolExists[token0][token1]) revert PoolDoesNotExist();

        LiquidityPool storage pool = liquidityPools[token0][token1];
        uint256 totalSupply = pool.totalLPSupply;

        if (totalSupply == 0 || pool.reserveA == 0 || pool.reserveB == 0) {
            revert InsufficientLiquidity();
        }

        // Calculate amounts
        (uint256 amount0, uint256 amount1) = ExhibitionAMMLibrary.calculateRemoveAmounts(
            _lpAmount,
            pool.reserveA,
            pool.reserveB,
            totalSupply
        );

        amountA = (_tokenA == token0) ? amount0 : amount1;
        amountB = (_tokenA == token0) ? amount1 : amount0;

        if (amountA < _amountAMin || amountB < _amountBMin) revert SlippageTooHigh();

        // Burn LP tokens
        _burnLiquidity(token0, token1, msg.sender, _lpAmount);

        // Transfer tokens
        _transferTokens(_tokenA, address(this), _to, amountA);
        _transferTokens(_tokenB, address(this), _to, amountB);

        // Update reserves
        uint256 newReserve0 = pool.reserveA - amount0;
        uint256 newReserve1 = pool.reserveB - amount1;
        _updateReserves(token0, token1, newReserve0, newReserve1);

        emit LiquidityRemoved(msg.sender, _tokenA, _tokenB, amountA, amountB);
    }

    // ================================
    //       Swap
    // ================================
    
    /**
     * @dev Swap tokens
     */
    function _swapTokenForToken(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _minAmountOut,
        address _to,
        uint256 _deadline
    ) internal returns (uint256 amountOut) {
        if (block.timestamp >= _deadline) revert DeadlineExpired();
        if (_to == address(0)) revert InvalidRecipient();
        if (_tokenIn == address(0) || _tokenOut == address(0) || _tokenIn == _tokenOut) {
            revert InvalidTokenAddress();
        }
        if (_amountIn == 0) revert ExhibitionAMMLibrary.ZeroAmount();

        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenIn, _tokenOut);
        if (!poolExists[token0][token1]) revert PoolDoesNotExist();

        // Transfer input tokens
        _transferTokens(_tokenIn, msg.sender, address(this), _amountIn);

        // Calculate fees
        (uint256 tradingFeeAmount, uint256 protocolFeeAmount,) = _calculateSwapFees(_amountIn);

        // Get reserves
        (uint256 reserveIn, uint256 reserveOut) = _getReserves(_tokenIn, _tokenOut);

        // Calculate output amount with fees
        uint256 amountInAfterFees = _amountIn - tradingFeeAmount;
        uint256 numerator = amountInAfterFees * reserveOut;
        uint256 denominator = reserveIn + amountInAfterFees;
        amountOut = numerator / denominator;

        if (amountOut < _minAmountOut) revert SlippageTooHigh();

        // Process fees
        _processSwapFees(token0, token1, _tokenIn, tradingFeeAmount, protocolFeeAmount);

        // Transfer output tokens
        _transferTokens(_tokenOut, address(this), _to, amountOut);

        // Update reserves (including LP fees that stay in pool)
        uint256 newReserveIn = reserveIn + _amountIn - protocolFeeAmount;
        uint256 newReserveOut = reserveOut - amountOut;
        
        uint256 newReserve0 = (_tokenIn == token0) ? newReserveIn : newReserveOut;
        uint256 newReserve1 = (_tokenIn == token0) ? newReserveOut : newReserveIn;

        _updateReserves(token0, token1, newReserve0, newReserve1);

        emit Swap(msg.sender, _tokenIn, _tokenOut, _amountIn, amountOut, tradingFeeAmount, protocolFeeAmount);
    }
}