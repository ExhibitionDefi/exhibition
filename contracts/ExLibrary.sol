// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "contracts/interfaces/ExInterfaces.sol"; // For custom errors
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title Exhibition Platform Utility Library
 * @dev This library provides helper functions for mathematical operations,
 * token sorting, and other utilities used across the Exhibition Launchpad and AMM contracts.
 * Functions here are 'pure' or 'view' and do not modify contract state directly.
 */
library ExLibrary {

    // Using a very small number to prevent total LP supply from ever being zero
    // which protects against potential division-by-zero errors in liquidity calculations
    // and mimics a standard safety measure from Uniswap V2.
    // This MINIMUM_LIQUIDITY is usually burned to address(0) on first liquidity provision.
    uint256 internal constant MINIMUM_LIQUIDITY = 1000;

    // Minimum percentage of net raised funds that must go to liquidity (70%)
    uint256 internal constant MIN_LIQUIDITY_PERCENTAGE = 7000; // 70%

    // Maximum percentage of net raised funds that can go to liquidity (100%)
    uint256 internal constant MAX_LIQUIDITY_PERCENTAGE = 10000; // 100%

    // Fee denominator (e.g., 10_000 for basis points)
    uint256 internal constant FEE_DENOMINATOR = 10_000;

    /**
     * @dev Calculates the integer square root of a number.
     * @param y The number to calculate the square root of.
     * @return z The integer square root of y.
     */
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    /**
     * @dev Sorts two token addresses into a canonical order (token0, token1).
     * This ensures that each unique pair always has the same order, regardless
     * of which order they are provided in. Essential for consistent pool lookups.
     * @param tokenA The address of the first token.
     * @param tokenB The address of the second token.
     * @return token0 The address of the lexicographically smaller token.
     * @return token1 The address of the lexicographically larger token.
     */
    function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        if (tokenA == address(0) || tokenB == address(0)) {
            revert InvalidTokenAddress(); // Error from ExInterfaces.sol
        }
        if (tokenA == tokenB) {
            revert InvalidPair(); // Error from ExInterfaces.sol
        }
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    /**
     * @dev Internal function to check if an address is the zero address.
     * @param _addr The address to check.
     * @return True if the address is the zero address, false otherwise.
     */
    function isZeroAddress(address _addr) internal pure returns (bool) {
        return _addr == address(0);
    }

    /**
     * @dev Calculates the output amount of tokens for a swap given an input amount
     * and the current reserves of the input and output tokens.
     * Implements the Uniswap V2 constant product formula: (reserveIn + amountIn) * (reserveOut - amountOut) = reserveIn * reserveOut
     * with a 0.3% fee applied to the input amount.
     * @param amountIn The amount of input tokens to swap.
     * @param reserveIn The current reserve of the input token in the pool.
     * @param reserveOut The current reserve of the output token in the pool.
     * @return amountOut The calculated amount of output tokens.
     */
    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256 amountOut) {
        if (reserveIn == 0 || reserveOut == 0) {
            revert InsufficientLiquidity(); // Error from ExInterfaces.sol
        }
        if (amountIn == 0) {
            revert ZeroAmount(); // Error from ExInterfaces.sol
        }

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;

        amountOut = numerator / denominator;

        if (amountOut == 0) {
            revert ZeroAmount(); // Error from ExInterfaces.sol
        }
    }
}

// ========================================
// 2. LIBRARY WITH ALL IMPLEMENTATION
// ========================================

/**
 * @title TokenCalculationLib
 * @dev Library containing all calculation logic
 */
library TokenCalculationLib {
    
    // ========================================
    // CONSTANTS
    // ========================================
    
    uint256 public constant MIN_TOKEN_PRICE = 1e12;     // 0.000001 in 18 decimals
    uint256 public constant MAX_TOKEN_PRICE = 1e24;     // 1,000,000 in 18 decimals
    uint8 public constant MAX_TOKEN_DECIMALS = 30;
    uint256 public constant PRICE_DECIMALS = 18;

    // Error codes
    uint8 public constant ERROR_NONE = 0;
    uint8 public constant ERROR_ZERO_CONTRIBUTION = 1;
    uint8 public constant ERROR_ZERO_PRICE = 2;
    uint8 public constant ERROR_PRICE_TOO_LOW = 3;
    uint8 public constant ERROR_PRICE_TOO_HIGH = 4;
    uint8 public constant ERROR_INVALID_DECIMALS = 5;
    uint8 public constant ERROR_CONTRIBUTION_TOO_LARGE = 6;
    uint8 public constant ERROR_CONTRIBUTION_TOO_SMALL = 7;
    uint8 public constant ERROR_CALCULATION_OVERFLOW = 8;
    uint8 public constant ERROR_ZERO_TOKENS_CALCULATED = 9;

    // ========================================
    // MAIN CALCULATION FUNCTIONS
    // ========================================

    /**
     * @dev Main calculation function
     */
    function calculateTokensDue(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress,
        address projectTokenAddress
    ) internal view returns (uint256) {
        if (contributorContribution == 0) return 0;
        validateTokenPrice(tokenPrice);

        uint8 contributionDecimals = getTokenDecimals(contributionTokenAddress);
        uint8 projectDecimals = getTokenDecimals(projectTokenAddress);

        if (contributionDecimals > MAX_TOKEN_DECIMALS || projectDecimals > MAX_TOKEN_DECIMALS) {
            revert InvalidTokenDecimals();
        }

        return performCalculation(
            contributorContribution,
            tokenPrice,
            contributionDecimals,
            projectDecimals
        );
    }

    /**
     * @dev Get detailed calculation preview No try-catch on internal calls
     */
    function getCalculationPreview(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress,
        address projectTokenAddress
    ) internal view returns (ITokenCalculation.CalculationPreview memory) {
        
        uint8 contributionDecimals = getTokenDecimals(contributionTokenAddress);
        uint8 projectDecimals = getTokenDecimals(projectTokenAddress);
        
        uint256 contributionIn18Decimals = scaleToDecimals(
            contributorContribution, 
            contributionDecimals, 
            18
        );

        uint256 tokensReceived;
        bool isValid;
        
        // Direct call instead of try-catch since it's internal
        if (contributorContribution == 0 || 
            tokenPrice == 0 || 
            tokenPrice < MIN_TOKEN_PRICE || 
            tokenPrice > MAX_TOKEN_PRICE ||
            contributionDecimals > MAX_TOKEN_DECIMALS || 
            projectDecimals > MAX_TOKEN_DECIMALS) {
            tokensReceived = 0;
            isValid = false;
        } else {
            // Use internal validation before calling
            tokensReceived = TokenCalculationLib.calculateTokensDue(
                contributorContribution,
                tokenPrice,
                contributionTokenAddress,
                projectTokenAddress
            );
            isValid = tokensReceived > 0;
        }

        uint256 minimumContribution = getMinimumContribution(
            tokenPrice,
            contributionTokenAddress,
            projectTokenAddress
        );

        return ITokenCalculation.CalculationPreview({
            tokensReceived: tokensReceived,
            contributionIn18Decimals: contributionIn18Decimals,
            effectivePrice: tokenPrice,
            contributionDecimals: contributionDecimals,
            projectDecimals: projectDecimals,
            minimumContribution: minimumContribution,
            isValid: isValid
        });
    }

    /**
     * @dev Validate calculation without reverting  No try-catch
     */
    function validateCalculation(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress,
        address projectTokenAddress
    ) internal view returns (ITokenCalculation.ValidationResult memory) {
        
        if (contributorContribution == 0) {
            return ITokenCalculation.ValidationResult(false, ERROR_ZERO_CONTRIBUTION);
        }
        
        if (tokenPrice == 0) {
            return ITokenCalculation.ValidationResult(false, ERROR_ZERO_PRICE);
        }
        
        if (tokenPrice < MIN_TOKEN_PRICE) {
            return ITokenCalculation.ValidationResult(false, ERROR_PRICE_TOO_LOW);
        }
        if (tokenPrice > MAX_TOKEN_PRICE) {
            return ITokenCalculation.ValidationResult(false, ERROR_PRICE_TOO_HIGH);
        }
        
        uint8 contributionDecimals = getTokenDecimals(contributionTokenAddress);
        uint8 projectDecimals = getTokenDecimals(projectTokenAddress);
        
        if (contributionDecimals > MAX_TOKEN_DECIMALS || projectDecimals > MAX_TOKEN_DECIMALS) {
            return ITokenCalculation.ValidationResult(false, ERROR_INVALID_DECIMALS);
        }
        
        // Manual validation instead of try-catch
        uint256 tokens = TokenCalculationLib.calculateTokensDue(
            contributorContribution,
            tokenPrice,
            contributionTokenAddress,
            projectTokenAddress
        );
        
        if (tokens == 0) {
            return ITokenCalculation.ValidationResult(false, ERROR_ZERO_TOKENS_CALCULATED);
        }
        
        return ITokenCalculation.ValidationResult(true, ERROR_NONE);
    }

    /**
     * @dev Get minimum contribution for 1 token
     */
    function getMinimumContribution(
        uint256 tokenPrice,
        address contributionTokenAddress,
        address projectTokenAddress
    ) internal view returns (uint256) {
        uint8 contributionDecimals = getTokenDecimals(contributionTokenAddress);
        uint8 projectDecimals = getTokenDecimals(projectTokenAddress);
        
        uint256 oneTokenIn18Decimals = scaleToDecimals(1, projectDecimals, 18);
        uint256 costIn18Decimals = (oneTokenIn18Decimals * tokenPrice) / 1e18;
        
        return scaleToDecimals(costIn18Decimals, 18, contributionDecimals);
    }

    /**
     * @dev Get token information
     */
    function getTokenInfo(address tokenAddress) 
        internal 
        view 
        returns (ITokenCalculation.TokenInfo memory) 
    {
        uint8 decimals = 18; // default
        string memory symbol = "TOKEN"; // default
        string memory name = "Unknown Token"; // default

        //  Use low-level calls instead of try-catch for better gas efficiency
        (bool success, bytes memory data) = tokenAddress.staticcall(abi.encodeWithSignature("decimals()"));
        if (success && data.length == 32) {
            decimals = abi.decode(data, (uint8));
        }
        
        (success, data) = tokenAddress.staticcall(abi.encodeWithSignature("symbol()"));
        if (success && data.length > 0) {
            symbol = abi.decode(data, (string));
        }
        
        (success, data) = tokenAddress.staticcall(abi.encodeWithSignature("name()"));
        if (success && data.length > 0) {
            name = abi.decode(data, (string));
        }

        return ITokenCalculation.TokenInfo({
            decimals: decimals,
            symbol: symbol,
            name: name
        });
    }

    /**
     * @dev Batch calculate tokens No try-catch
     */
    function batchCalculateTokens(
        uint256[] calldata contributionAmounts,
        uint256 tokenPrice,
        address contributionTokenAddress,
        address projectTokenAddress
    ) internal view returns (uint256[] memory tokensReceived) {
        tokensReceived = new uint256[](contributionAmounts.length);
        
        for (uint256 i = 0; i < contributionAmounts.length; i++) {
            // Pre-validate to avoid reverts in batch operations
            ITokenCalculation.ValidationResult memory validation = validateCalculation(
                contributionAmounts[i],
                tokenPrice,
                contributionTokenAddress,
                projectTokenAddress
            );
            
            if (validation.isValid) {
                tokensReceived[i] = TokenCalculationLib.calculateTokensDue(
                    contributionAmounts[i],
                    tokenPrice,
                    contributionTokenAddress,
                    projectTokenAddress
                );
            } else {
                tokensReceived[i] = 0;
            }
        }
    }

    /**
     * @dev Get system constants
     */
    function getSystemConstants() 
        internal 
        pure 
        returns (ITokenCalculation.SystemConstants memory) 
    {
        return ITokenCalculation.SystemConstants({
            minTokenPrice: MIN_TOKEN_PRICE,
            maxTokenPrice: MAX_TOKEN_PRICE,
            maxTokenDecimals: MAX_TOKEN_DECIMALS,
            priceDecimals: PRICE_DECIMALS
        });
    }

    // ========================================
    // INTERNAL HELPER FUNCTIONS
    // ========================================

    function performCalculation(
        uint256 contribution,
        uint256 price,
        uint8 contributionDecimals,
        uint8 projectDecimals
    ) internal pure returns (uint256) {
        uint256 contributionIn18Decimals = scaleToDecimals(contribution, contributionDecimals, 18);
        
        if (contributionIn18Decimals > type(uint256).max / 1e18) {
            revert CalculationOverflow();
        }
        
        uint256 tokensIn18Decimals = (contributionIn18Decimals * 1e18) / price;
        
        if (tokensIn18Decimals == 0) {
            revert ZeroTokensCalculated();
        }

        return scaleToDecimals(tokensIn18Decimals, 18, projectDecimals);
    }

    function scaleToDecimals(
        uint256 amount,
        uint8 fromDecimals,
        uint8 toDecimals
    ) internal pure returns (uint256) {
        if (fromDecimals == toDecimals) {
            return amount;
        }

        if (fromDecimals < toDecimals) {
            uint8 decimalDiff = toDecimals - fromDecimals;
            uint256 scaleFactor = 10 ** decimalDiff;
            
            if (amount > type(uint256).max / scaleFactor) {
                revert CalculationOverflow();
            }
            
            return amount * scaleFactor;
        } else {
            uint8 decimalDiff = fromDecimals - toDecimals;
            uint256 scaleFactor = 10 ** decimalDiff;
            
            uint256 result = amount / scaleFactor;
            
            if (result == 0 && amount > 0) {
                revert ContributionTooSmall();
            }
            
            return result;
        }
    }

    function getTokenDecimals(address tokenAddress) internal view returns (uint8) {
        (bool success, bytes memory data) = tokenAddress.staticcall(abi.encodeWithSignature("decimals()"));
        if (success && data.length == 32) {
            return abi.decode(data, (uint8));
        }
        return 18; // Default fallback
    }

    function validateTokenPrice(uint256 price) internal pure {
        if (price == 0) revert ZeroTokenPrice();
        if (price < MIN_TOKEN_PRICE) revert TokenPriceTooLow();
        if (price > MAX_TOKEN_PRICE) revert TokenPriceTooHigh();
    }
}