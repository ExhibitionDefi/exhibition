// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

abstract contract ExhibitionRefunds is ExhibitionBase {
    using SafeERC20 for IERC20;
    
    function requestRefund(uint256 _projectId) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();
        if (project.status != ProjectStatus.Failed && project.status != ProjectStatus.Refundable) {
            revert ProjectNotRefundable();
        }

        uint256 contributorContribution = contributions[_projectId][msg.sender];
        if (contributorContribution == 0) revert NoContributionToRefund();
        if (hasRefunded[_projectId][msg.sender]) {
            revert AlreadyRefunded();
        }

        if (project.status == ProjectStatus.Failed) {
            project.status = ProjectStatus.Refundable;
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Refundable);
        }

        _transferTokens(project.contributionTokenAddress, address(this), msg.sender, contributorContribution);

        hasRefunded[_projectId][msg.sender] = true;

        emit RefundIssued(_projectId, msg.sender, contributorContribution);
    }

    function requestEmergencyRefund(uint256 _projectId) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();

        if (project.status != ProjectStatus.Successful && project.status != ProjectStatus.Claimable) {
            revert InvalidProjectStatus();
        }

        if (project.liquidityAdded) {
            revert LiquidityAlreadyAdded();
        }

        uint256 deadlineBlock = successBlock[_projectId] + LIQUIDITY_FINALIZATION_DEADLINE_BLOCKS;
        if (block.number < deadlineBlock) {
            revert LiquidityDeadlineNotReached();
        }

        uint256 contributorContribution = contributions[_projectId][msg.sender];
        if (contributorContribution == 0) revert NoContributionToRefund();

        if (hasRefunded[_projectId][msg.sender]) {
            revert AlreadyRefunded();
        }

        if (project.status == ProjectStatus.Successful || project.status == ProjectStatus.Claimable) {
            project.status = ProjectStatus.Refundable;
            emit LiquidityDeadlinePassed(_projectId, block.number);
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Refundable);
        }

        _transferTokens(
            project.contributionTokenAddress,
            address(this),
            msg.sender,
            contributorContribution
        );

        hasRefunded[_projectId][msg.sender] = true;

        emit RefundIssued(_projectId, msg.sender, contributorContribution);
    }

    function withdrawUnsoldTokens(uint256 _projectId) external nonReentrant {
        Project storage project = projects[_projectId];

        if (msg.sender != project.projectOwner) revert Unauthorized();

        if (!(
            project.status == ProjectStatus.Failed ||
            project.status == ProjectStatus.Refundable ||
            project.totalRaised < project.fundingGoal
        )) revert InvalidProjectStatus();

        if (project.status == ProjectStatus.Upcoming || project.status == ProjectStatus.Active) {
            revert InvalidProjectStatus();
        }

        if (block.number < project.endBlock + WITHDRAWAL_UNSOLD_DELAY_BLOCKS) revert WithdrawalLocked();

        uint256 unsoldTokens = project.amountTokensForSale - project.tokensSold;

        if (unsoldTokens == 0) revert NoUnsoldTokens();

        project.unsoldTokensWithdrawn = unsoldTokens;

        IERC20(project.projectToken).safeTransfer(project.projectOwner, unsoldTokens);

        emit UnsoldTokensWithdrawn(_projectId, project.projectOwner, unsoldTokens);
    }
}