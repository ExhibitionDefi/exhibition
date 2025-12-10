// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ExhibitionAMMLibrary
 * @dev Pure calculation functions for the AMM
 */
library ExhibitionAMMLibrary {
    
    // ================================
    //       Error Definitions
    // ================================
    error InvalidAmount();
    error InsufficientLiquidity();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidTokenAddress();

    // ================================
    //    Fixed-Point Arithmetic
    // ================================
    
    uint224 constant Q112 = 2**112;

    function encode(uint112 y) internal pure returns (uint224 z) {
        z = uint224(y) * Q112;
    }

    function decode(uint224 z) internal pure returns (uint112 y) {
        y = uint112(z / Q112);
    }

    function mulDiv(uint256 x, uint256 y, uint256 z) internal pure returns (uint256) {
        require(z != 0, "mulDiv: division by zero");
        uint256 mm = x * y;
        if (mm == 0) return 0;
        return mm / z;
    }

    // ================================
    //      Math Helpers
    // ================================
    
    /**
     * @dev Babylonian square root method
     */
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = x;
        uint256 y = x / 2 + 1;
        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        }
        return z;
    }

    /**
     * @dev Returns the minimum of two numbers
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // ================================
    //    Token Sorting & Validation
    // ================================
    
    /**
     * @dev Ensures consistent ordering of token addresses
     */
    function sortTokens(address _tokenA, address _tokenB) 
        internal 
        pure 
        returns (address token0, address token1) 
    {
        if (_tokenA == address(0) || _tokenB == address(0)) {
            revert ZeroAddress();
        }
        if (_tokenA == _tokenB) {
            revert InvalidTokenAddress();
        }

        if (_tokenA < _tokenB) {
            token0 = _tokenA;
            token1 = _tokenB;
        } else {
            token0 = _tokenB;
            token1 = _tokenA;
        }
    }

    // ================================
    //    AMM Calculations
    // ================================
    
    /**
     * @dev Calculate output amount with fees (Uniswap V2 style)
     * @param amountIn Input amount
     * @param reserveIn Input token reserve
     * @param reserveOut Output token reserve
     * @param tradingFeeBps Trading fee in basis points (e.g., 30 = 0.3%)
     * @return amountOut Output amount
     * @return feeAmount Fee amount charged
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 tradingFeeBps
    ) internal pure returns (uint256 amountOut, uint256 feeAmount) {
        if (amountIn == 0) revert ZeroAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        // Calculate fee: feeAmount = amountIn * tradingFeeBps / 10000
        feeAmount = (amountIn * tradingFeeBps) / 10000;
        
        // Amount after fee
        uint256 amountInAfterFee = amountIn - feeAmount;
        
        // AMM formula: amountOut = (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee)
        uint256 numerator = amountInAfterFee * reserveOut;
        uint256 denominator = reserveIn + amountInAfterFee;
        
        amountOut = numerator / denominator;
    }

    /**
     * @dev Calculate optimal amounts for adding liquidity
     */
    function calculateOptimalAmounts(
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 reserveA,
        uint256 reserveB
    ) internal pure returns (uint256 amountA, uint256 amountB) {
        if (reserveA == 0 && reserveB == 0) {
            // New pool - use desired amounts
            return (amountADesired, amountBDesired);
        }
        
        // Calculate optimal amounts based on current ratio
        uint256 amountBOptimal = (reserveB * amountADesired) / reserveA;
        
        if (amountBOptimal <= amountBDesired) {
            amountA = amountADesired;
            amountB = amountBOptimal;
        } else {
            uint256 amountAOptimal = (reserveA * amountBDesired) / reserveB;
            amountA = amountAOptimal;
            amountB = amountBDesired;
        }
    }

    /**
     * @dev Calculate liquidity tokens to mint
     */
    function calculateLiquidity(
        uint256 amountA,
        uint256 amountB,
        uint256 reserveA,
        uint256 reserveB,
        uint256 totalSupply
    ) internal pure returns (uint256 liquidity) {
        if (totalSupply == 0) {
            // Initial liquidity
            liquidity = sqrt(amountA * amountB);
        } else {
            // Proportional liquidity
            uint256 liquidityA = (amountA * totalSupply) / reserveA;
            uint256 liquidityB = (amountB * totalSupply) / reserveB;
            liquidity = min(liquidityA, liquidityB);
        }
    }

    /**
     * @dev Calculate amounts to receive when removing liquidity
     */
    function calculateRemoveAmounts(
        uint256 lpAmount,
        uint256 reserveA,
        uint256 reserveB,
        uint256 totalSupply
    ) internal pure returns (uint256 amountA, uint256 amountB) {
        amountA = (lpAmount * reserveA) / totalSupply;
        amountB = (lpAmount * reserveB) / totalSupply;
    }

    /**
     * @dev Calculate protocol fee from trading fee
     * @param tradingFeeAmount Total trading fee collected
     * @param protocolFeeBps Protocol fee as percentage of trading fee in basis points
     * @return protocolFeeAmount Amount to send to protocol
     */
    function calculateProtocolFee(
        uint256 tradingFeeAmount,
        uint256 protocolFeeBps
    ) internal pure returns (uint256 protocolFeeAmount) {
        protocolFeeAmount = (tradingFeeAmount * protocolFeeBps) / 10000;
    }

    /**
     * @dev Calculate price impact percentage (scaled by 1e18)
     */
    function calculatePriceImpact(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 tradingFeeBps
    ) internal pure returns (uint256 impactPercentage) {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) return 0;
        
        // Current price
        uint256 currentPrice = (reserveOut * 1e18) / reserveIn;
        
        // Amount out after fees
        (uint256 amountOut,) = getAmountOut(amountIn, reserveIn, reserveOut, tradingFeeBps);
        
        if (amountOut == 0) return 0;
        
        // Effective price
        uint256 effectivePrice = (amountIn * 1e18) / amountOut;
        
        // Calculate impact
        if (effectivePrice > currentPrice) {
            impactPercentage = ((effectivePrice - currentPrice) * 10000) / currentPrice;
        }
    }

    /**
     * @dev Calculate share percentage in basis points
     */
    function calculateSharePercentage(
        uint256 userBalance,
        uint256 totalSupply
    ) internal pure returns (uint256 sharePercentage) {
        if (totalSupply == 0) return 0;
        sharePercentage = (userBalance * 10000) / totalSupply;
    }
}