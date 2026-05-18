// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

abstract contract ExhibitionFaucet is ExhibitionBase {
    
    function requestFaucetTokens() public nonReentrant {
        if (exhTokenAddress == address(0) && USDXTokenAddress == address(0)) {
            revert FaucetNotConfigured();
        }
        if (faucetCooldownBlocks > 0 && lastFaucetRequestBlock[msg.sender] + faucetCooldownBlocks > block.number) {
            revert FaucetCooldownActive();
        }
        if (faucetAmountEXH > 0) {
            if (exhTokenAddress == address(0)) revert FaucetAmountNotSet();
            IExhibitionToken(exhTokenAddress).mint(msg.sender, faucetAmountEXH);
            emit FaucetMinted(msg.sender, exhTokenAddress, faucetAmountEXH);
        }
        if (faucetAmountUSDX > 0) {
            if (USDXTokenAddress == address(0)) revert FaucetAmountNotSet();
            INexusUSD(USDXTokenAddress).mint(msg.sender, faucetAmountUSDX);
            emit FaucetMinted(msg.sender, USDXTokenAddress, faucetAmountUSDX);
        }
        lastFaucetRequestBlock[msg.sender] = block.number;
        emit FaucetRequested(msg.sender, faucetAmountEXH, faucetAmountUSDX);
    }

    function lastFaucetRequest(address _user) external view returns (uint256) {
        return lastFaucetRequestBlock[_user];
    }
}