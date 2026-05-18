// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IExhibitionAMM
 * @dev Minimal interface for Exhibition contract interactions with AMM
 */
interface IExhibitionAMM {

    // ================================
    //       Functions Exhibition Uses
    // ================================
    
    /**
     * @dev Add liquidity with automatic lock for launchpad projects
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
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    /**
     * @dev Get exNEX address
     */
    function exNEXADDRESS() external view returns (address);
}