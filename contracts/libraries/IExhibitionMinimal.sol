// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IExhibitionMinimal
 * @dev Minimal interface for ExhibitionAMM to interact with Exhibition contract
 * This avoids circular dependencies and keeps AMM lightweight
 */
interface IExhibitionMinimal {
    /**
     * @dev Check if a token address is a project token created through Exhibition
     * @param token The token address to check
     * @return bool True if the token is a project token, false otherwise
     */
    function isProjectToken(address token) external view returns (bool);
    
    /**
     * @dev Get the project ID associated with a project token
     * @param token The project token address
     * @return uint256 The project ID (returns 0 if not a project token)
     */
    function projectTokenToProjectId(address token) external view returns (uint256);
}