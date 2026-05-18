// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

abstract contract ExhibitionVesting is ExhibitionBase {

    function _getVestedAmount(
        Project storage _project,
        uint256 _projectId,
        uint256 _totalTokensDue
    ) internal view returns (uint256) {

        if (!_project.vestingEnabled) {
            return _totalTokensDue;
        }

        uint256 projectSuccessBlock = successBlock[_projectId];
        uint256 vestingStartBlock = projectSuccessBlock + _project.vestingCliffBlocks;
        uint256 vestingEndBlock = projectSuccessBlock + _project.vestingDurationBlocks;

        uint256 currentBlock = block.number;

        uint256 initialReleaseAmount = (_totalTokensDue * _project.vestingInitialRelease) / 10000;

        // Before vesting starts → only initial release
        if (currentBlock < vestingStartBlock) {
            return initialReleaseAmount;
        }

        // Vesting fully complete → release everything
        if (currentBlock >= vestingEndBlock) {
            return _totalTokensDue;
        }

        uint256 vestingBlocksAfterCliff = _project.vestingDurationBlocks - _project.vestingCliffBlocks;

        if (vestingBlocksAfterCliff == 0) {
            return _totalTokensDue;
        }

        uint256 intervalsTotal = vestingBlocksAfterCliff / _project.vestingIntervalBlocks;

        if (intervalsTotal == 0) {
            return _totalTokensDue;
        }

        uint256 blocksSinceStart = currentBlock - vestingStartBlock;

        uint256 intervalsElapsed = blocksSinceStart / _project.vestingIntervalBlocks;

        if (intervalsElapsed > intervalsTotal) {
            intervalsElapsed = intervalsTotal;
        }

        uint256 remainingTokens = _totalTokensDue - initialReleaseAmount;

        uint256 vestedLinear = (remainingTokens * intervalsElapsed) / intervalsTotal;

        return initialReleaseAmount + vestedLinear;
    }
}