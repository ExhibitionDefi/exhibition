// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

abstract contract ExhibitionLiquidity is ExhibitionBase {
    
    function depositLiquidityTokens(uint256 _projectId, uint256 _amount) external nonReentrant {
        if (_projectId == 0 || _amount == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();
        if (msg.sender != project.projectOwner) revert NotProjectOwner();
        if (project.status != ProjectStatus.Successful && project.status != ProjectStatus.Claimable) {
            revert InvalidProjectStatus();
        }
        if (project.liquidityAdded) {
            revert LiquidityAlreadyAdded();
        }

        uint256 deadline = successBlock[_projectId] + LIQUIDITY_FINALIZATION_DEADLINE_BLOCKS;
        if (block.number >= deadline) {
            revert LiquidityDeadlineExpired();
        }

        uint256 totalContributionTokensRaised = project.totalRaised;
        uint256 platformFeeAmount = (totalContributionTokensRaised * platformFeePercentage) / 10000;
        uint256 netRaisedAfterFee = totalContributionTokensRaised - platformFeeAmount;
        uint256 contributionTokensForLiquidity = (netRaisedAfterFee * project.liquidityPercentage) / 10000;

        uint256 requiredProjectTokensForLiquidity = TokenCalculationLib.calculateTokensDue(
            contributionTokensForLiquidity,
            project.tokenPrice,
            project.contributionTokenAddress
        );

        if (projectLiquidityTokenDeposits[_projectId] + _amount > requiredProjectTokensForLiquidity) {
            revert ExcessiveLiquidityDeposit();
        }

        _transferTokens(project.projectToken, msg.sender, address(this), _amount);

        projectLiquidityTokenDeposits[_projectId] += _amount;
        
        emit LiquidityTokensDeposited(_projectId, msg.sender, _amount);
    }

    function finalizeLiquidityAndReleaseFunds(uint256 _projectId) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();
        if (msg.sender != project.projectOwner) revert NotProjectOwner();
        if (project.status != ProjectStatus.Successful && project.status != ProjectStatus.Claimable) {
            revert ProjectNotSuccessfulForLiquidity();
        }
        if (project.liquidityAdded) {
            revert LiquidityAlreadyAdded();
        }
        if (exhibitionAMM == address(0)) revert AMMNotSet();
        if (platformFeeRecipient == address(0)) revert PlatformFeeRecipientNotSet();

        uint256 totalContributionTokensRaised = project.totalRaised;
        uint256 platformFeeAmount = (totalContributionTokensRaised * platformFeePercentage) / 10000;
        uint256 netRaisedAfterFee = totalContributionTokensRaised - platformFeeAmount;

        if (platformFeeAmount > 0) {
            _transferTokens(project.contributionTokenAddress, address(this), platformFeeRecipient, platformFeeAmount);
            emit PlatformFeeCollected(_projectId, project.contributionTokenAddress, platformFeeAmount, platformFeeRecipient);
        }

        uint256 contributionTokensForLiquidity = (netRaisedAfterFee * project.liquidityPercentage) / 10000;

        uint256 requiredProjectTokensForLiquidity = TokenCalculationLib.calculateTokensDue(
            contributionTokensForLiquidity,
            project.tokenPrice,
            project.contributionTokenAddress
        );

        if (projectLiquidityTokenDeposits[_projectId] < requiredProjectTokensForLiquidity) {
            revert InsufficientLiquidityTokensDeposited();
        }

        IERC20(project.projectToken).approve(exhibitionAMM, requiredProjectTokensForLiquidity);
        IERC20(project.contributionTokenAddress).approve(exhibitionAMM, contributionTokensForLiquidity);

        uint256 actualAmountA;
        uint256 actualAmountB;
        uint256 actualLiquidityMinted;

        uint256 ammDeadline = block.number + 3_600; // 1 hour in blocks

        (actualAmountA, actualAmountB, actualLiquidityMinted) = IExhibitionAMM(exhibitionAMM).addLiquidityWithLock(
            project.projectToken,
            project.contributionTokenAddress,
            requiredProjectTokensForLiquidity,
            contributionTokensForLiquidity,
            requiredProjectTokensForLiquidity,
            contributionTokensForLiquidity,
            project.projectOwner,
            ammDeadline,
            _projectId,
            project.lockDurationBlocks
        );

        uint256 remainingContributionTokensForOwner = netRaisedAfterFee - contributionTokensForLiquidity;

        if (remainingContributionTokensForOwner > 0) {
            _transferTokens(
                project.contributionTokenAddress,
                address(this),
                project.projectOwner,
                remainingContributionTokensForOwner
            );
            emit FundsReleasedToProjectOwner(_projectId, project.projectOwner, remainingContributionTokensForOwner, ProjectStatus.Completed);
        }

        project.liquidityAdded = true;
        project.status = ProjectStatus.Completed;
        emit ProjectStatusUpdated(_projectId, ProjectStatus.Completed);
        emit LiquidityAdded(_projectId, project.projectOwner, actualAmountA, actualAmountB, actualLiquidityMinted);
    }
}