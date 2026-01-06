// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

abstract contract ExhibitionClaims is ExhibitionBase {
    
    function _calculateAvailableVestingAmount(Project storage _project, uint256 _totalTokensDue) internal view returns (uint256) {
        if (!_project.vestingEnabled) {
            return _totalTokensDue;
        }

        uint256 currentTime = block.timestamp;
        uint256 projectStartTime = _project.startTime;
        uint256 vestingCliffTime = projectStartTime + _project.vestingCliff;
        uint256 vestingEndTime = projectStartTime + _project.vestingDuration;

        uint256 initialReleaseAmount = (_totalTokensDue * _project.vestingInitialRelease) / 10000;

        if (currentTime < vestingCliffTime) {
            return initialReleaseAmount;
        }

        if (currentTime >= vestingEndTime) {
            return _totalTokensDue;
        }

        uint256 timeElapsedAfterCliff = currentTime - vestingCliffTime;
        uint256 vestingPeriodAfterCliff = _project.vestingDuration - _project.vestingCliff;

        if (vestingPeriodAfterCliff == 0) {
            return _totalTokensDue;
        }

        uint256 remainingTokensToVestLinearly = _totalTokensDue - initialReleaseAmount;
        uint256 vestedLinearAmount = (remainingTokensToVestLinearly * timeElapsedAfterCliff) / vestingPeriodAfterCliff;

        uint256 totalVested = initialReleaseAmount + vestedLinearAmount;
        if (totalVested > _totalTokensDue) {
            totalVested = _totalTokensDue;
        }

        return totalVested;
    }

    function claimTokens(uint256 _projectId) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();

        uint256 contributorContribution = contributions[_projectId][msg.sender];
        if (contributorContribution == 0) revert NoContributionFound();

        uint256 totalTokensDue = TokenCalculationLib.calculateTokensDue(
            contributorContribution,
            project.tokenPrice,
            project.contributionTokenAddress
        );

        VestingInfo storage userVestingInfo = vestingInfo[_projectId][msg.sender];

        if (userVestingInfo.totalAmount == 0) {
            userVestingInfo.totalAmount = totalTokensDue;
            userVestingInfo.releasedAmount = 0;
            userVestingInfo.lastClaimTime = project.startTime;
            userVestingInfo.nextClaimTime = project.startTime + project.vestingInterval;
        }

        uint256 totalVestedToDate = _calculateAvailableVestingAmount(project, totalTokensDue);
        uint256 amountToTransfer = totalVestedToDate - userVestingInfo.releasedAmount;

        if (amountToTransfer == 0) {
            revert NoTokensCurrentlyVested();
        }

        if (project.status != ProjectStatus.Successful &&
            project.status != ProjectStatus.Claimable &&
            project.status != ProjectStatus.Completed) {
            revert InvalidProjectStatus();
        }

        if (project.status == ProjectStatus.Successful) {
            project.status = ProjectStatus.Claimable;
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Claimable);
        }

        _transferTokens(project.projectToken, address(this), msg.sender, amountToTransfer);

        userVestingInfo.releasedAmount += amountToTransfer;
        userVestingInfo.lastClaimTime = block.timestamp;

        emit TokensClaimed(_projectId, msg.sender, amountToTransfer, userVestingInfo.releasedAmount);
    }
}