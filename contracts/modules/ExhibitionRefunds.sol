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

    /**
     * @dev Allows contributors to get refund if owner fails to finalize liquidity
     * Can only be called if:
     * 1. Project is Successful/Claimable
     * 2. Liquidity NOT added yet
     * 3. Deadline has passed since success
     */
    function requestEmergencyRefund(uint256 _projectId) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();

        // Must be Successful or Claimable (not Completed)
        if (project.status != ProjectStatus.Successful && project.status != ProjectStatus.Claimable) {
            revert InvalidProjectStatus();
        }

        // Liquidity must NOT have been added
        if (project.liquidityAdded) {
            revert LiquidityAlreadyAdded();
        }

        // Check deadline has passed
        uint256 deadline = successTimestamp[_projectId] + LIQUIDITY_FINALIZATION_DEADLINE;
        if (block.timestamp < deadline) {
            revert LiquidityDeadlineNotReached(); // New error
        }

        // Get contributor's contribution
        uint256 contributorContribution = contributions[_projectId][msg.sender];
        if (contributorContribution == 0) revert NoContributionToRefund();

        // Check not already refunded
        if (hasRefunded[_projectId][msg.sender]) {
            revert AlreadyRefunded();
        }

        // On first emergency refund, change status
        if (project.status == ProjectStatus.Successful) {
            project.status = ProjectStatus.Refundable;
            emit LiquidityDeadlinePassed(_projectId, block.timestamp);
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Refundable);
        }

        // Return contributor's original contribution
        _transferTokens(
            project.contributionTokenAddress,
            address(this),
            msg.sender,
            contributorContribution
        );

        // Mark as refunded
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

        if (block.timestamp < project.endTime + WITHDRAWAL_DELAY) revert WithdrawalLocked();

        uint256 unsoldTokens;

        if (project.status == ProjectStatus.Failed || project.status == ProjectStatus.Refundable) {
            unsoldTokens = IERC20(project.projectToken).balanceOf(address(this));
        } else {
            ITokenCalculation.ValidationResult memory validation = TokenCalculationLib.validateCalculation(
                project.totalRaised,
                project.tokenPrice,
                project.contributionTokenAddress
            );

            if (!validation.isValid) {
                unsoldTokens = IERC20(project.projectToken).balanceOf(address(this));
            } else {
                uint256 tokensAllocated = TokenCalculationLib.calculateTokensDue(
                    project.totalRaised,
                    project.tokenPrice,
                    project.contributionTokenAddress
                );

                if (project.amountTokensForSale < tokensAllocated) {
                    revert InvalidTokenAllocation();
                }

                unsoldTokens = project.amountTokensForSale - tokensAllocated;
            }
        }

        if (unsoldTokens == 0) revert NoUnsoldTokens();

        uint256 contractBalance = IERC20(project.projectToken).balanceOf(address(this));
        if (contractBalance < unsoldTokens) revert InsufficientTokenBalance();

        project.amountTokensForSale = 0;

        IERC20(project.projectToken).safeTransfer(project.projectOwner, unsoldTokens);

        emit UnsoldTokensWithdrawn(_projectId, project.projectOwner, unsoldTokens);
    }
}