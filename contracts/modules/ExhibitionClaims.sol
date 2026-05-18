// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionVesting.sol";

abstract contract ExhibitionClaims is ExhibitionVesting {

    function claimTokens(uint256 _projectId) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();

        if (
            project.status != ProjectStatus.Successful &&
            project.status != ProjectStatus.Claimable &&
            project.status != ProjectStatus.Completed
        ) {
            revert InvalidProjectStatus();
        }

        VestingInfo storage user = vestingInfo[_projectId][msg.sender];

        uint256 contributorContribution = contributions[_projectId][msg.sender];

        if (contributorContribution == 0) {
            revert NoContributionFound();
        }

        uint256 totalTokensDue = TokenCalculationLib.calculateTokensDue(
            contributorContribution,
            project.tokenPrice,
            project.contributionTokenAddress
        );

        // initialize accounting only
        if (user.totalAmount == 0) {
            user.totalAmount = totalTokensDue;
            user.releasedAmount = 0;
            user.lastClaimBlock = 0;
        }

        uint256 vestedAmount = _getVestedAmount(project, _projectId, totalTokensDue);
        uint256 claimableAmount = vestedAmount - user.releasedAmount;

        if (claimableAmount == 0) {
            revert NoTokensCurrentlyVested();
        }

        if (project.status == ProjectStatus.Successful) {
            project.status = ProjectStatus.Claimable;
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Claimable);
        }

        _transferTokens(
            project.projectToken,
            address(this),
            msg.sender,
            claimableAmount
        );

        user.releasedAmount += claimableAmount;
        user.lastClaimBlock = block.number;

        emit TokensClaimed(
            _projectId,
            msg.sender,
            claimableAmount,
            user.releasedAmount
        );
    }
}