// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

abstract contract ExhibitionContributions is ExhibitionBase {
    using SafeERC20 for IERC20;
    
    function contribute(uint256 _projectId, uint256 _amount) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();
        if (_amount == 0) revert ZeroAmount();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();
        if (project.projectOwner == msg.sender) revert CannotContributeToOwnProject();
        if (project.status != ProjectStatus.Active) revert ProjectNotActive();
        if (block.number < project.startBlock) revert InvalidInput();
        if (block.number >= project.endBlock) revert InvalidInput();

        uint256 currentContribution = contributions[_projectId][msg.sender];
        uint256 newTotalContribution = currentContribution + _amount;

        if (newTotalContribution < project.minContribution) revert ContributionTooLow();
        if (newTotalContribution > project.maxContribution) revert ExceedsMaxContribution();
        if (project.totalRaised + _amount > project.fundingGoal) revert FundingGoalExceeded();

        if (!hasContributed[_projectId][msg.sender]) {
            hasContributed[_projectId][msg.sender] = true;
            projectContributors[_projectId].push(msg.sender);
            contributorCount[_projectId]++;
            emit FirstTimeContributor(_projectId, msg.sender, contributorCount[_projectId]);
        }

        uint256 newTotalRaised = project.totalRaised + _amount;
        project.totalRaised = newTotalRaised;
        contributions[_projectId][msg.sender] = newTotalContribution;

        IERC20(project.contributionTokenAddress).safeTransferFrom(msg.sender, address(this), _amount);

        if (newTotalRaised >= project.fundingGoal) {
            project.endBlock = block.number;
            project.status = ProjectStatus.Successful;
            project.tokensSold = TokenCalculationLib.calculateTokensDue(
                project.totalRaised,
                project.tokenPrice,
                project.contributionTokenAddress
            );
            successBlock[_projectId] = block.number;
            emit ContributionMade(_projectId, msg.sender, _amount, project.contributionTokenAddress, newTotalRaised);
            emit HardCapReached(_projectId, newTotalRaised, project.fundingGoal);
            emit ProjectFinalized(_projectId, ProjectStatus.Successful, newTotalRaised);
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Successful);
            return;
        }

        emit ContributionMade(_projectId, msg.sender, _amount, project.contributionTokenAddress, newTotalRaised);
    }

    function finalizeProject(uint256 _projectId) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();
        if (project.status != ProjectStatus.Active) {
            revert InvalidProjectStatus();
        }
        if (block.number < project.endBlock) {
            revert FundingPeriodNotEnded();
        }

        if (project.totalRaised >= project.softCap) {
            project.status = ProjectStatus.Successful;
            project.tokensSold = TokenCalculationLib.calculateTokensDue(
                project.totalRaised,
                project.tokenPrice,
                project.contributionTokenAddress
            );
            successBlock[_projectId] = block.number;
            emit ProjectFinalized(_projectId, ProjectStatus.Successful, project.totalRaised);
            emit SoftCapReach(_projectId, project.totalRaised, project.softCap);
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Successful);
        } else {
            project.status = ProjectStatus.Failed;
            emit ProjectFinalized(_projectId, ProjectStatus.Failed, project.totalRaised);
            emit SoftCapNotReach(_projectId, project.totalRaised);
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Failed);
        }
    }
}