// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionVesting.sol";

abstract contract ExhibitionViews is ExhibitionVesting {
    
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

    function _getNextClaimBlock(
        Project storage _project,
        uint256 _projectId,
        uint256 _currentBlock
    ) internal view returns (uint256) {

        uint256 successBlock_ = successBlock[_projectId];
        uint256 vestingStart  = successBlock_ + _project.vestingCliffBlocks;
        uint256 vestingEndBlock = successBlock_ + _project.vestingDurationBlocks;

        if (_currentBlock <= vestingStart) {
            return vestingStart + _project.vestingIntervalBlocks;
        }

        uint256 elapsed          = _currentBlock - vestingStart;
        uint256 intervalsElapsed = elapsed / _project.vestingIntervalBlocks;
        uint256 nextBlock        = vestingStart + ((intervalsElapsed + 1) * _project.vestingIntervalBlocks);

        return nextBlock > vestingEndBlock ? vestingEndBlock : nextBlock;
    }

    function getUserVestingInfo(uint256 projectId, address user)
        external
        view
        returns (
            uint256 totalAmount,
            uint256 releasedAmount,
            uint256 startBlock,
            uint256 lastClaimBlock,
            uint256 vestedAmount,
            uint256 claimableAmount,
            uint256 nextClaimBlock
        )
    {
        VestingInfo storage vesting = vestingInfo[projectId][user];
        Project storage project = projects[projectId];

        totalAmount    = vesting.totalAmount;
        releasedAmount = vesting.releasedAmount;
        startBlock     = vesting.startBlock;
        lastClaimBlock = vesting.lastClaimBlock;

        if (totalAmount == 0) {
            return (0, 0, 0, 0, 0, 0, 0);
        }

        vestedAmount = _getVestedAmount(
            project,
            projectId,
            totalAmount
        );

        claimableAmount = vestedAmount > releasedAmount ? vestedAmount - releasedAmount : 0;
        nextClaimBlock = _getNextClaimBlock(
            project,
            projectId,
            block.number
        );
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

    function getProjectBlocksRemaining(uint256 projectId) external view returns (uint256 blocksRemaining) {
        Project storage project = projects[projectId];

        if (block.number >= project.endBlock) {
            return 0;
        }

        return project.endBlock - block.number;
    }

    function canAcceptContributions(uint256 projectId) external view returns (bool) {
        Project storage project = projects[projectId];

        return project.status == ProjectStatus.Active &&
            block.number >= project.startBlock &&
            block.number < project.endBlock &&
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
            MIN_START_DELAY_BLOCKS,
            MAX_END_DURATION_BLOCKS,
            WITHDRAWAL_UNSOLD_DELAY_BLOCKS
        );
    }

    function getMinLockDuration() external pure returns (uint256) {
        return MIN_LOCK_DURATION_BLOCKS;
    }

    function getFaucetSettings() external view returns (
        uint256 exhAmount,
        uint256 usdtAmount,
        uint256 cooldownBlocks
    ) {
        return (faucetAmountEXH, faucetAmountUSDX, faucetCooldownBlocks);
    }

    function getProjectDetails(uint256 projectId) external view returns (
        Project memory project,
        uint256 progressPercentage,
        uint256 blocksRemaining,
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

        if (block.number >= project.endBlock) {
            blocksRemaining = 0;
        } else {
            blocksRemaining = project.endBlock - block.number;
        }

        canContribute = project.status == ProjectStatus.Active &&
            block.number >= project.startBlock &&
            block.number < project.endBlock &&
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
        totalContributors        = contributorCount[projectId];
    }

    function getUserProjectSummary(uint256 projectId, address user)
        external
        view
        returns (
            uint256 contributionAmount,
            uint256 tokensOwed,
            uint256 tokensVested,
            uint256 tokensClaimed,
            uint256 tokensAvailable,
            bool userHasRefunded,
            bool canClaim
        )
    {
        Project storage project = projects[projectId];

        contributionAmount = contributions[projectId][user];
        userHasRefunded    = hasRefunded[projectId][user];

        if (contributionAmount == 0 || userHasRefunded) {
            return (0, 0, 0, 0, 0, userHasRefunded, false);
        }

        tokensOwed = TokenCalculationLib.calculateTokensDue(
            contributionAmount,
            project.tokenPrice,
            project.contributionTokenAddress
        );

        VestingInfo storage vesting = vestingInfo[projectId][user];

        tokensClaimed = vesting.releasedAmount;

        if (
            project.status != ProjectStatus.Successful &&
            project.status != ProjectStatus.Claimable &&
            project.status != ProjectStatus.Completed
        ) {
            return (
                contributionAmount,
                tokensOwed,
                0,
                tokensClaimed,
                0,
                userHasRefunded,
                false
            );
        }

        tokensVested = _getVestedAmount(
            project,
            projectId,
            tokensOwed
        );

        tokensAvailable = tokensVested > tokensClaimed ? tokensVested - tokensClaimed : 0;

        canClaim = tokensAvailable > 0;
    }

    function getContractAddresses() external view returns (
        address factory,
        address amm,
        address exhToken,
        address USDXToken
    ) {
        return (
            exhibitionFactory,
            exhibitionAMM,
            exhTokenAddress,
            USDXTokenAddress
        );
    }

    function getProjectContributorCount(uint256 projectId) external view returns (uint256) {
        return contributorCount[projectId];
    }

    function hasUserContributed(uint256 projectId, address user) external view returns (bool) {
        return hasContributed[projectId][user];
    }

    function isEmergencyRefundAvailable(uint256 projectId) external view returns (
        bool available,
        uint256 deadlineBlock,
        uint256 blocksRemaining
    ) {
        Project storage project = projects[projectId];
    
        if (project.status != ProjectStatus.Successful || project.liquidityAdded) {
            return (false, 0, 0);
        }
    
        deadlineBlock = successBlock[projectId] + LIQUIDITY_FINALIZATION_DEADLINE_BLOCKS;
    
        if (block.number >= deadlineBlock) {
            available      = true;
            blocksRemaining = 0;
        } else {
            available      = false;
            blocksRemaining = deadlineBlock - block.number;
        }
    }

    function getLiquidityDeadlineBlock(uint256 projectId) external view returns (uint256) {
        return successBlock[projectId] + LIQUIDITY_FINALIZATION_DEADLINE_BLOCKS;
    }

    function getProjectTokenSummary(uint256 projectId) external view returns (
        uint256 forSale,
        uint256 sold,
        uint256 unsold,
        uint256 unsoldWithdrawn
    ) {
        Project storage p = projects[projectId];
        forSale         = p.amountTokensForSale;
        sold            = p.tokensSold;
        unsold          = p.amountTokensForSale - p.tokensSold;
        unsoldWithdrawn = p.unsoldTokensWithdrawn;
    }
}