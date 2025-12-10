// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

abstract contract ExhibitionTokenDeployment is ExhibitionBase {
    
    function deployStandaloneToken(string memory _name, string memory _symbol, uint256 _initialSupply, string memory _logoURI) public nonReentrant returns (address newTokenAddress) {
        if (address(exhibitionFactory) == address(0)) {
            revert FactoryNotSet();
        }
        if (_initialSupply == 0) {
            revert ZeroAmount();
        }
        newTokenAddress = IExhibitionFactory(exhibitionFactory).createToken(_name, _symbol, _initialSupply, _logoURI, msg.sender);
        emit StandaloneTokenDeployed(msg.sender, newTokenAddress, _name, _symbol, _initialSupply, _logoURI);
    }
}