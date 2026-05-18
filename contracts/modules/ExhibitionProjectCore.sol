// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

abstract contract ExhibitionProjectCore is ExhibitionBase {
    using TokenCalculationLib for *;
    
    function createLaunchpadProject(
        string memory _projectTokenName,
        string memory _projectTokenSymbol,
        uint256 _initialTotalSupply,
        string memory _projectTokenLogoURI,
        address _contributionTokenAddress,
        uint256 _fundingGoal,
        uint256 _softCap,
        uint256 _minContribution,
        uint256 _maxContribution,
        uint256 _tokenPrice,
        uint256 _startBlock,
        uint256 _endBlock,
        uint256 _amountTokensForSale,
        uint256 _liquidityPercentage,
        uint256 _lockDurationBlocks,
        bool _vestingEnabled,
        uint256 _vestingCliffBlocks,
        uint256 _vestingDurationBlocks,
        uint256 _vestingIntervalBlocks,
        uint256 _vestingInitialRelease
    ) external nonReentrant returns (uint256 projectId, address projectTokenAddress) {
        
        // Input validations
        if (address(exhibitionFactory) == address(0)) revert FactoryNotSet();
        if (address(exhibitionAMM) == address(0)) revert AMMNotSet();
        if (_initialTotalSupply == 0) revert ZeroAmount();
        if (_fundingGoal == 0) revert ZeroAmount();
        if (_softCap == 0) revert ZeroAmount();
        if (_softCap > _fundingGoal) revert InvalidInput();
        if (_minContribution == 0) revert ZeroAmount();
        if (_maxContribution == 0) revert ZeroAmount();
        if (_minContribution > _maxContribution) revert InvalidInput();
        TokenCalculationLib.validateTokenPrice(_tokenPrice);
        if (_amountTokensForSale == 0) revert ZeroAmount();
        if (_amountTokensForSale > _initialTotalSupply) revert InvalidInput();
        if (_startBlock == 0 || _endBlock == 0) revert InvalidInput();
        if (_startBlock >= _endBlock) revert InvalidStartBlocks();
        if (_startBlock < block.number) revert InvalidStartBlocks();
        if (_liquidityPercentage < ExLibrary.MIN_LIQUIDITY_PERCENTAGE || _liquidityPercentage > ExLibrary.MAX_LIQUIDITY_PERCENTAGE) {
            revert InvalidPercentage();
        }
        _checkExhibitionContributionToken(_contributionTokenAddress);

        if (_vestingEnabled) {
            if (_vestingDurationBlocks == 0) revert InvalidInput();
            if (_vestingCliffBlocks > _vestingDurationBlocks) revert InvalidInput();
            if (_vestingIntervalBlocks == 0 && _vestingDurationBlocks > 0) revert InvalidInput();
            if (_vestingInitialRelease > ExLibrary.FEE_DENOMINATOR) revert InvalidPercentage();
        } else {
            if (_vestingCliffBlocks != 0 || _vestingDurationBlocks != 0 || _vestingIntervalBlocks != 0 || _vestingInitialRelease != 0) {
                revert InvalidInput();
            }
        }

        if (_startBlock <= block.number + MIN_START_DELAY_BLOCKS) {
            revert InvalidStartBlocks();
        }
        if (_endBlock <= _startBlock) {
            revert InvalidEndBlocks();
        }
        if (_endBlock - _startBlock > MAX_END_DURATION_BLOCKS) {
            revert InvalidDurationBlocks();
        }
        if (_lockDurationBlocks < MIN_LOCK_DURATION_BLOCKS) {
            revert InvalidDurationBlocks();
        }

        TokenCalculationLib.validateProjectTokenomics(
            _initialTotalSupply,
            _fundingGoal,
            _softCap,
            _amountTokensForSale,
            _tokenPrice,
            _liquidityPercentage,
            _contributionTokenAddress
        );

        projectId = ++projectIdCounter;

        address newProjectTokenAddress = IExhibitionFactory(exhibitionFactory).createToken(
            _projectTokenName,
            _projectTokenSymbol,
            _initialTotalSupply,
            _projectTokenLogoURI,
            msg.sender
        );

        if (newProjectTokenAddress == address(0)) revert CallFailed();
        projectTokenAddress = newProjectTokenAddress;

        isProjectToken[newProjectTokenAddress] = true;
        projectTokenToProjectId[newProjectTokenAddress] = projectId;

        Project storage newProject = projects[projectId];
        newProject.projectOwner             = msg.sender;
        newProject.projectToken             = newProjectTokenAddress;
        newProject.contributionTokenAddress = _contributionTokenAddress;
        newProject.fundingGoal              = _fundingGoal;
        newProject.softCap                  = _softCap;
        newProject.minContribution          = _minContribution;
        newProject.maxContribution          = _maxContribution;
        newProject.tokenPrice               = _tokenPrice;
        newProject.startBlock               = _startBlock;
        newProject.endBlock                 = _endBlock;
        newProject.totalRaised              = 0;
        newProject.totalProjectTokenSupply  = _initialTotalSupply;
        newProject.projectTokenLogoURI      = _projectTokenLogoURI;
        newProject.amountTokensForSale      = _amountTokensForSale;
        newProject.liquidityPercentage      = _liquidityPercentage;
        newProject.lockDurationBlocks       = _lockDurationBlocks;
        newProject.status                   = ProjectStatus.Upcoming;
        newProject.liquidityAdded           = false;
        newProject.vestingEnabled           = _vestingEnabled;
        newProject.vestingCliffBlocks       = _vestingCliffBlocks;
        newProject.vestingDurationBlocks    = _vestingDurationBlocks;
        newProject.vestingIntervalBlocks    = _vestingIntervalBlocks;
        newProject.vestingInitialRelease    = _vestingInitialRelease;

        emit ProjectCreated(
            projectId,
            msg.sender,
            newProjectTokenAddress,
            _contributionTokenAddress,
            _fundingGoal,
            _softCap,
            _initialTotalSupply,
            _projectTokenLogoURI,
            _amountTokensForSale,
            _liquidityPercentage,
            _lockDurationBlocks,
            _startBlock,
            _endBlock
        );
    }

    function depositProjectTokens(uint256 _projectId, uint256 _amount) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();
        if (_amount == 0) revert ZeroAmount();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();
        if (project.projectOwner != msg.sender) revert NotProjectOwner();
        if (project.status != ProjectStatus.Upcoming) revert InvalidProjectStatus();
        if (_amount != project.amountTokensForSale) revert InvalidInput();

        _transferTokens(project.projectToken, msg.sender, address(this), _amount);

        project.status = ProjectStatus.Active;

        emit TokensDepositedForProject(_projectId, project.projectToken, project.amountTokensForSale, ProjectStatus.Active);
    }
}