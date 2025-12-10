// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ExhibitionAMMStorage.sol";
import "./ExhibitionAMMLibrary.sol";
import "./ExhibitionAMMErrors.sol";

/**
 * @title ExhibitionAMMFees
 * @dev Fee management logic for the Exhibition AMM
 */
abstract contract ExhibitionAMMFees is ExhibitionAMMStorage, ExhibitionAMMErrors {
    using ExhibitionAMMLibrary for uint256;

    // ================================
    //       Constants
    // ================================
    
    uint256 public constant MAX_TRADING_FEE = 100; // 1% max (in basis points)
    uint256 public constant MAX_PROTOCOL_FEE = 3000; // 30% max of trading fee (in basis points)
    uint256 public constant FEE_DENOMINATOR = 10000; // Basis points denominator

    // ================================
    //       Fee Configuration
    // ================================
    
    /**
     * @dev Initialize fee configuration
     * @param _tradingFeeBps Trading fee in basis points (e.g., 30 = 0.3%)
     * @param _protocolFeeBps Protocol fee as % of trading fee (e.g., 1667 = 16.67%)
     * @param _feeRecipient Address to receive protocol fees
     */
    function _initializeFees(
        uint256 _tradingFeeBps,
        uint256 _protocolFeeBps,
        address _feeRecipient
    ) internal {
        if (_tradingFeeBps > MAX_TRADING_FEE) revert InvalidFeeConfiguration();
        if (_protocolFeeBps > MAX_PROTOCOL_FEE) revert InvalidFeeConfiguration();
        if (_feeRecipient == address(0)) revert ZeroAddress();

        feeConfig = FeeConfig({
            tradingFee: _tradingFeeBps,
            protocolFee: _protocolFeeBps,
            feeRecipient: _feeRecipient,
            feesEnabled: true
        });

        emit FeeConfigUpdated(_tradingFeeBps, _protocolFeeBps, _feeRecipient);
    }

    /**
     * @dev Update fee configuration (owner only)
     */
    function _setFeeConfig(
        uint256 _tradingFeeBps,
        uint256 _protocolFeeBps,
        address _feeRecipient
    ) internal {
        if (_tradingFeeBps > MAX_TRADING_FEE) revert InvalidFeeConfiguration();
        if (_protocolFeeBps > MAX_PROTOCOL_FEE) revert InvalidFeeConfiguration();
        if (_feeRecipient == address(0)) revert ZeroAddress();

        feeConfig.tradingFee = _tradingFeeBps;
        feeConfig.protocolFee = _protocolFeeBps;
        feeConfig.feeRecipient = _feeRecipient;

        emit FeeConfigUpdated(_tradingFeeBps, _protocolFeeBps, _feeRecipient);
    }

    /**
     * @dev Toggle fee collection on/off
     */
    function _setFeesEnabled(bool _enabled) internal {
        feeConfig.feesEnabled = _enabled;
    }

    // ================================
    //       Fee Calculations
    // ================================
    
    /**
     * @dev Calculate swap fees
     * @param amountIn Input amount
     * @return tradingFeeAmount Total trading fee
     * @return protocolFeeAmount Protocol's share of trading fee
     * @return lpFeeAmount LP providers' share of trading fee
     */
    function _calculateSwapFees(uint256 amountIn) 
        internal 
        view 
        returns (
            uint256 tradingFeeAmount,
            uint256 protocolFeeAmount,
            uint256 lpFeeAmount
        ) 
    {
        if (!feeConfig.feesEnabled) {
            return (0, 0, 0);
        }

        // Calculate total trading fee
        tradingFeeAmount = (amountIn * feeConfig.tradingFee) / FEE_DENOMINATOR;
        
        // Calculate protocol's share
        protocolFeeAmount = ExhibitionAMMLibrary.calculateProtocolFee(
            tradingFeeAmount, 
            feeConfig.protocolFee
        );
        
        // LP providers get the rest
        lpFeeAmount = tradingFeeAmount - protocolFeeAmount;
    }

    /**
     * @dev Process swap fees and distribute
     * @param token0 First token address (canonical order)
     * @param token1 Second token address (canonical order)
     * @param tokenIn Token being swapped in
     * @param tradingFeeAmount Total trading fee amount
     * @param protocolFeeAmount Protocol fee amount
     */
    function _processSwapFees(
        address token0,
        address token1,
        address tokenIn,
        uint256 tradingFeeAmount,
        uint256 protocolFeeAmount
    ) internal {
        if (tradingFeeAmount == 0) return;

        // Accumulate protocol fees for later collection
        if (protocolFeeAmount > 0) {
            if (tokenIn == token0) {
                accumulatedProtocolFeesToken0[token0][token1] += protocolFeeAmount;
            } else {
                accumulatedProtocolFeesToken1[token0][token1] += protocolFeeAmount;
            }
        }

        // Update fee tracking for statistics
        totalFeesCollected[token0][token1] += tradingFeeAmount;
        lastFeeUpdateTime[token0][token1] = block.timestamp;
        
        // Note: LP fees stay in the pool as they're already included in reserves
        // This increases the value of LP tokens automatically
    }

    // ================================
    //       Fee Collection
    // ================================
    
    /**
     * @dev Collect accumulated protocol fees for a specific pool
     * @param token0 First token address (canonical order)
     * @param token1 Second token address (canonical order)
     */
    function _collectProtocolFees(address token0, address token1) internal {
        uint256 fees0 = accumulatedProtocolFeesToken0[token0][token1];
        uint256 fees1 = accumulatedProtocolFeesToken1[token0][token1];

        if (fees0 == 0 && fees1 == 0) revert NoFeesToCollect();

        address recipient = feeConfig.feeRecipient;

        // Reset accumulated fees
        if (fees0 > 0) {
            accumulatedProtocolFeesToken0[token0][token1] = 0;
            bool success = IERC20(token0).transfer(recipient, fees0);
            if (!success) revert TokenTransferFailed();
        }

        if (fees1 > 0) {
            accumulatedProtocolFeesToken1[token0][token1] = 0;
            bool success = IERC20(token1).transfer(recipient, fees1);
            if (!success) revert TokenTransferFailed();
        }

        emit ProtocolFeesCollected(token0, token1, fees0, fees1, recipient);
    }

    /**
     * @dev Collect protocol fees from multiple pools in one transaction
     * @param tokenPairs Array of token pair arrays
     */
    function _collectProtocolFeesMultiple(address[][] memory tokenPairs) internal {
        for (uint256 i = 0; i < tokenPairs.length; i++) {
            require(tokenPairs[i].length == 2, "Invalid token pair");
            
            (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(
                tokenPairs[i][0], 
                tokenPairs[i][1]
            );

            uint256 fees0 = accumulatedProtocolFeesToken0[token0][token1];
            uint256 fees1 = accumulatedProtocolFeesToken1[token0][token1];

            if (fees0 > 0 || fees1 > 0) {
                _collectProtocolFees(token0, token1);
            }
        }
    }

    // ================================
    //       View Functions
    // ================================
    
    /**
     * @dev Get accumulated protocol fees for a pool
     */
    function getAccumulatedProtocolFees(address tokenA, address tokenB) 
        external 
        view 
        returns (uint256 fees0, uint256 fees1) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(tokenA, tokenB);
        fees0 = accumulatedProtocolFeesToken0[token0][token1];
        fees1 = accumulatedProtocolFeesToken1[token0][token1];
    }

    /**
     * @dev Get current fee configuration
     */
    function getFeeConfig() 
        external 
        view 
        returns (
            uint256 tradingFee,
            uint256 protocolFee,
            address feeRecipient,
            bool feesEnabled
        ) 
    {
        return (
            feeConfig.tradingFee,
            feeConfig.protocolFee,
            feeConfig.feeRecipient,
            feeConfig.feesEnabled
        );
    }

    /**
     * @dev Calculate expected fees for a swap amount
     */
    function calculateExpectedFees(uint256 amountIn) 
        external 
        view 
        returns (
            uint256 tradingFee,
            uint256 protocolFee,
            uint256 lpFee
        ) 
    {
        return _calculateSwapFees(amountIn);
    }

    /**
     * @dev Get total fees collected for a pool
     */
    function getTotalFeesCollected(address tokenA, address tokenB) 
        external 
        view 
        returns (uint256 totalFees) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(tokenA, tokenB);
        return totalFeesCollected[token0][token1];
    }
}