// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

abstract contract ExhibitionViews is ExhibitionBase {
    
    function getProjectCount() external view returns (uint256) {
        return projectIdCounter;
    }

    function getProjects(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256 total = projectIdCounter;
        if (offset >= total) return new uint256[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        uint256[] memory projectIds = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            projectIds[i - offset] = i + 1;
        }
        return projectIds;
    }

    function getProjectsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= projectIdCounter; i++) {
            if (projects[i].projectOwner == owner) {
                count++;
            }
        }

        uint256[] memory ownerProjects = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= projectIdCounter; i++) {
            if (projects[i].projectOwner == owner) {
                ownerProjects[index] = i;
                index++;
            }
        }
        return ownerProjects;
    }

    function getProjectsByStatus(ProjectStatus status) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= projectIdCounter; i++) {
            if (projects[i].status == status) {
                count++;
            }
        }

        uint256[] memory statusProjects = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= projectIdCounter; i++) {
            if (projects[i].status == status) {
                statusProjects[index] = i;
                index++;
            }
        }
        return statusProjects;
    }

    function getUserContribution(uint256 projectId, address user) external view returns (uint256) {
        return contributions[projectId][user];
    }

    function getUserVestingInfo(uint256 projectId, address user) external view returns (
        uint256 totalAmount,
        uint256 releasedAmount,
        uint256 startTime,
        uint256 lastClaimTime,
        uint256 nextClaimTime,
        uint256 availableAmount
    ) {
        VestingInfo storage vesting = vestingInfo[projectId][user];
        Project storage project = projects[projectId];

        totalAmount = vesting.totalAmount;
        releasedAmount = vesting.releasedAmount;
        startTime = vesting.startTime;
        lastClaimTime = vesting.lastClaimTime;
        nextClaimTime = vesting.nextClaimTime;

        if (totalAmount > 0) {
            uint256 totalVested = _calculateAvailableVestingAmountView(project, totalAmount);
            availableAmount = totalVested > releasedAmount ? totalVested - releasedAmount : 0;
        } else {
            uint256 contributorContribution = contributions[projectId][user];
            if (contributorContribution > 0) {
                uint256 totalTokensDue = TokenCalculationLib.calculateTokensDue(
                    contributorContribution,
                    project.tokenPrice,
                    project.contributionTokenAddress
                );
                uint256 totalVested = _calculateAvailableVestingAmountView(project, totalTokensDue);
                availableAmount = totalVested;
            } else {
                availableAmount = 0;
            }
        }
    }

    function _calculateAvailableVestingAmountView(Project storage _project, uint256 _totalTokensDue) private view returns (uint256) {
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

    function hasUserBeenRefunded(uint256 projectId, address user) external view returns (bool) {
        return hasRefunded[projectId][user];
    }

    function getProjectProgress(uint256 projectId) external view returns (uint256 progressPercentage) {
        Project storage project = projects[projectId];
        if (project.fundingGoal == 0) return 0;

        progressPercentage = (project.totalRaised * 10000) / project.fundingGoal;
        if (progressPercentage > 10000) progressPercentage = 10000;
    }

    function getProjectTimeRemaining(uint256 projectId) external view returns (uint256 timeRemaining) {
        Project storage project = projects[projectId];

        if (block.timestamp >= project.endTime) {
            return 0;
        }

        return project.endTime - block.timestamp;
    }

    function canAcceptContributions(uint256 projectId) external view returns (bool) {
        Project storage project = projects[projectId];

        return project.status == ProjectStatus.Active &&
            block.timestamp >= project.startTime &&
            block.timestamp < project.endTime &&
            project.totalRaised < project.fundingGoal;
    }

    function getProjectLiquidityDeposit(uint256 projectId) external view returns (uint256) {
        return projectLiquidityTokenDeposits[projectId];
    }

    function getRequiredLiquidityTokens(uint256 projectId) external view returns (uint256) {
        Project storage project = projects[projectId];

        if (project.totalRaised == 0) return 0;

        uint256 platformFeeAmount = (project.totalRaised * platformFeePercentage) / 10000;
        uint256 netRaisedAfterFee = project.totalRaised - platformFeeAmount;
        uint256 contributionTokensForLiquidity = (netRaisedAfterFee * project.liquidityPercentage) / 10000;

        return TokenCalculationLib.calculateTokensDue(
            contributionTokensForLiquidity,
            project.tokenPrice,
            project.contributionTokenAddress
        );
    }

    function getExhibitionContributionTokens() external view returns (address[] memory) {
        return ExhibitionContributionTokens;
    }

    function getPlatformSettings() external view returns (
        uint256 feePercentage,
        address feeRecipient,
        uint256 minStartDelay,
        uint256 maxProjectDuration,
        uint256 withdrawalDelay
    ) {
        return (
            platformFeePercentage,
            platformFeeRecipient,
            MIN_START_DELAY,
            MAX_PROJECT_DURATION,
            WITHDRAWAL_DELAY
        );
    }

    function getMinLockDuration() external pure returns (uint256) {
        return MIN_LOCK_DURATION;
    }

    function getFaucetSettings() external view returns (
        uint256 exhAmount,
        uint256 usdtAmount,
        uint256 cooldownSeconds
    ) {
        return (faucetAmountEXH, faucetAmountexUSD, faucetCooldownSeconds);
    }

    function getProjectDetails(uint256 projectId) external view returns (
        Project memory project,
        uint256 progressPercentage,
        uint256 timeRemaining,
        bool canContribute,
        uint256 requiredLiquidityTokens,
        uint256 depositedLiquidityTokens,
       uint256 totalContributors
    ) {
        project = projects[projectId];

        if (project.fundingGoal > 0) {
            progressPercentage = (project.totalRaised * 10000) / project.fundingGoal;
            if (progressPercentage > 10000) progressPercentage = 10000;
        } else {
            progressPercentage = 0;
        }

        if (block.timestamp >= project.endTime) {
            timeRemaining = 0;
        } else {
            timeRemaining = project.endTime - block.timestamp;
        }

        canContribute = project.status == ProjectStatus.Active &&
            block.timestamp >= project.startTime &&
            block.timestamp < project.endTime &&
            project.totalRaised < project.fundingGoal;

        if (project.totalRaised > 0) {
            uint256 platformFeeAmount = (project.totalRaised * platformFeePercentage) / 10000;
            uint256 netRaisedAfterFee = project.totalRaised - platformFeeAmount;
            uint256 contributionTokensForLiquidity = (netRaisedAfterFee * project.liquidityPercentage) / 10000;

            requiredLiquidityTokens = TokenCalculationLib.calculateTokensDue(
                contributionTokensForLiquidity,
                project.tokenPrice,
                project.contributionTokenAddress
            );
        } else {
            requiredLiquidityTokens = 0;
        }

        depositedLiquidityTokens = projectLiquidityTokenDeposits[projectId];

        totalContributors = contributorCount[projectId];
    }

    function getUserProjectSummary(uint256 projectId, address user) external view returns (
        uint256 contributionAmount,
        uint256 tokensOwed,
        uint256 tokensVested,
        uint256 tokensClaimed,
        uint256 tokensAvailable,
        bool userHasRefunded,
        bool canClaim
    ) {
        Project storage project = projects[projectId];
        contributionAmount = contributions[projectId][user];
        userHasRefunded = hasRefunded[projectId][user];

        if (contributionAmount > 0 && !userHasRefunded) {
            tokensOwed = TokenCalculationLib.calculateTokensDue(
                contributionAmount,
                project.tokenPrice,
                project.contributionTokenAddress
            );

            VestingInfo storage vesting = vestingInfo[projectId][user];
            tokensClaimed = vesting.releasedAmount;

            if (project.status == ProjectStatus.Successful ||
                project.status == ProjectStatus.Claimable ||
                project.status == ProjectStatus.Completed) {

                tokensVested = _calculateAvailableVestingAmountView(project, tokensOwed);
                tokensAvailable = tokensVested > tokensClaimed ? tokensVested - tokensClaimed : 0;
                canClaim = tokensAvailable > 0;
            }
        }
    }

    function getContractAddresses() external view returns (
        address factory,
        address amm,
        address exhToken,
        address exUSDToken
    ) {
        return (
            exhibitionFactory,
            exhibitionAMM,
            exhTokenAddress,
            exUSDTokenAddress
        );
    }

    /**
     * @dev Returns the number of unique contributors for a project
     */
    function getProjectContributorCount(uint256 projectId) external view returns (uint256) {
        return contributorCount[projectId];
    }

    /**
     * @dev Checks if an address has contributed to a project
     */
    function hasUserContributed(uint256 projectId, address user) external view returns (bool) {
        return hasContributed[projectId][user];
    }

    /**
     * @dev Check if emergency refund is available
     */
    function isEmergencyRefundAvailable(uint256 projectId) external view returns (
        bool available,
        uint256 deadline,
        uint256 timeRemaining
    ) {
        Project storage project = projects[projectId];
    
        if (project.status != ProjectStatus.Successful || project.liquidityAdded) {
           return (false, 0, 0);
        }
    
        deadline = successTimestamp[projectId] + LIQUIDITY_FINALIZATION_DEADLINE;
    
        if (block.timestamp >= deadline) {
            available = true;
            timeRemaining = 0;
        } else {
            available = false;
            timeRemaining = deadline - block.timestamp;
        }
    }

    /**
     * @dev Get liquidity finalization deadline for a project
     */
    function getLiquidityDeadline(uint256 projectId) external view returns (uint256) {
        return successTimestamp[projectId] + LIQUIDITY_FINALIZATION_DEADLINE;
    }
}