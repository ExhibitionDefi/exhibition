// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IExhibitionLPTokens
 * @dev Interface for the ExhibitionLPTokens contract.
 * This interface defines the functions that ExhibitionAMM will call on ExhibitionLPTokens
 * to manage LP token minting, burning, and balance queries.
 */
interface IExhibitionLPTokens {
    // --- View Functions ---
    function EXHIBITION_AMM_ADDRESS() external view returns (address);

    function balanceOf(address _tokenA, address _tokenB, address account) external view returns (uint256);
    function totalSupply(address _tokenA, address _tokenB) external view returns (uint256);
    // --- Write Functions (called by ExhibitionAMM or users) ---
    function setExhibitionAmmAddress(address _newAmmAddress) external; // Owner-only

    function mint(address _tokenA, address _tokenB, address to, uint256 amount) external; // onlyExhibitionAMM
    function burn(address _tokenA, address _tokenB, address from, uint256 amount) external; // onlyExhibitionAMM

    // --- Events ---
    event AmmAddressChanged(address indexed oldAmmAddress, address indexed newAmmAddress);
}
