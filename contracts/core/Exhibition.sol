// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../modules/ExhibitionConfig.sol";
import "../modules/ExhibitionTokenCalculation.sol";
import "../modules/ExhibitionFaucet.sol";
import "../modules/ExhibitionTokenDeployment.sol";
import "../modules/ExhibitionProjectCore.sol";
import "../modules/ExhibitionContributions.sol";
import "../modules/ExhibitionClaims.sol";
import "../modules/ExhibitionRefunds.sol";
import "../modules/ExhibitionLiquidity.sol";
import "../modules/ExhibitionViews.sol";

contract Exhibition is 
    ExhibitionConfig,
    ExhibitionTokenCalculation,
    ExhibitionFaucet,
    ExhibitionTokenDeployment,
    ExhibitionProjectCore,
    ExhibitionContributions,
    ExhibitionClaims,
    ExhibitionRefunds,
    ExhibitionLiquidity,
    ExhibitionViews
{
    constructor() {
        // All parent constructors automatically called
    }
}