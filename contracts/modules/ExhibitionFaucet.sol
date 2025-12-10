// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

abstract contract ExhibitionFaucet is ExhibitionBase {
    
    function requestFaucetTokens() public nonReentrant {
        if (exhTokenAddress == address(0) && exUSDTokenAddress == address(0)) {
            revert FaucetNotConfigured();
        }
        if (faucetCooldownSeconds > 0 && lastFaucetRequestTime[msg.sender] + faucetCooldownSeconds > block.timestamp) {
            revert FaucetCooldownActive();
        }
        if (faucetAmountEXH > 0) {
            if (exhTokenAddress == address(0)) revert FaucetAmountNotSet();
            IExhibitionToken(exhTokenAddress).mint(msg.sender, faucetAmountEXH);
            emit FaucetMinted(msg.sender, exhTokenAddress, faucetAmountEXH);
        }
        if (faucetAmountexUSD > 0) {
            if (exUSDTokenAddress == address(0)) revert FaucetAmountNotSet();
            IExhibitionUSD(exUSDTokenAddress).mint(msg.sender, faucetAmountexUSD);
            emit FaucetMinted(msg.sender, exUSDTokenAddress, faucetAmountexUSD);
        }
        lastFaucetRequestTime[msg.sender] = block.timestamp;
        emit FaucetRequested(msg.sender, faucetAmountEXH, faucetAmountexUSD);
    }

    function lastFaucetRequest(address _user) external view returns (uint256) {
        return lastFaucetRequestTime[_user];
    }
}