// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

/**
 * @title ExhibitionTokenCalculation
 * @dev Token calculation functions for Exhibition platform
 * @notice All Exhibition project tokens use 18 decimals - projectTokenAddress parameter removed for gas optimization
 */
abstract contract ExhibitionTokenCalculation is ExhibitionBase {
    using TokenCalculationLib for *;
    
    /**
     * @dev Calculate tokens due for a contribution
     * @param contributorContribution Amount contributed in contribution token decimals
     * @param tokenPrice Price per project token (always 18 decimals)
     * @param contributionTokenAddress Address of the contribution token (e.g., exUSD)
     * @return Amount of project tokens due (in 18 decimals)
     */
    function calculateTokensDue(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress
    ) external view override returns (uint256) {
        return TokenCalculationLib.calculateTokensDue(
            contributorContribution,
            tokenPrice,
            contributionTokenAddress
        );
    }

    /**
     * @dev Get detailed calculation preview
     * @param contributorContribution Amount contributed in contribution token decimals
     * @param tokenPrice Price per project token (always 18 decimals)
     * @param contributionTokenAddress Address of the contribution token
     * @return CalculationPreview struct with detailed calculation results
     */
    function getCalculationPreview(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress
    ) external view override returns (CalculationPreview memory) {
        return TokenCalculationLib.getCalculationPreview(
            contributorContribution,
            tokenPrice,
            contributionTokenAddress
        );
    }

    /**
     * @dev Validate calculation parameters
     * @param contributorContribution Amount contributed in contribution token decimals
     * @param tokenPrice Price per project token (always 18 decimals)
     * @param contributionTokenAddress Address of the contribution token
     * @return ValidationResult struct indicating if calculation is valid
     */
    function validateCalculation(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress
    ) external view override returns (ValidationResult memory) {
        return TokenCalculationLib.validateCalculation(
            contributorContribution,
            tokenPrice,
            contributionTokenAddress
        );
    }

    /**
     * @dev Get minimum contribution required for 1 project token
     * @param tokenPrice Price per project token (always 18 decimals)
     * @param contributionTokenAddress Address of the contribution token
     * @return Minimum contribution amount in contribution token decimals
     */
    function getMinimumContribution(
        uint256 tokenPrice,
        address contributionTokenAddress
    ) external view override returns (uint256) {
        return TokenCalculationLib.getMinimumContribution(
            tokenPrice,
            contributionTokenAddress
        );
    }

    /**
     * @dev Get token information (decimals, symbol, name)
     * @param tokenAddress Address of the token to query
     * @return TokenInfo struct with token details
     */
    function getTokenInfo(address tokenAddress) 
        external 
        view 
        override 
        returns (TokenInfo memory) 
    {
        return TokenCalculationLib.getTokenInfo(tokenAddress);
    }

    /**
     * @dev Batch calculate tokens for multiple contributions
     * @param contributionAmounts Array of contribution amounts
     * @param tokenPrice Price per project token (always 18 decimals)
     * @param contributionTokenAddress Address of the contribution token
     * @return Array of project token amounts due (in 18 decimals)
     */
    function batchCalculateTokens(
        uint256[] calldata contributionAmounts,
        uint256 tokenPrice,
        address contributionTokenAddress
    ) external view override returns (uint256[] memory) {
        return TokenCalculationLib.batchCalculateTokens(
            contributionAmounts,
            tokenPrice,
            contributionTokenAddress
        );
    }

    /**
     * @dev Get system constants (price limits, decimals)
     * @return SystemConstants struct with system configuration
     */
    function getSystemConstants() 
        external 
        pure 
        override 
        returns (SystemConstants memory) 
    {
        return TokenCalculationLib.getSystemConstants();
    }
}