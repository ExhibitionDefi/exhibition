// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "contracts/interfaces/ExInterfaces.sol"; // Contains interfaces and common errors, and ProjectStatus enum
import "./ExLibrary.sol";    // Contains helper functions like isZeroAddress and TokenCalculation logic
import "contracts/interfaces/IExhibitionAMM.sol";

contract Exhibition is Ownable, ReentrancyGuard, ITokenCalculation {
    using SafeERC20 for IERC20; // 🔒 SafeERC20 usage

    //  =============================================================================
    //               Constants for Project Time Constraints
    //  =============================================================================
    // Minimum delay before a project can start (e.g., 1 hour)
    uint256 public immutable MIN_START_DELAY = 15 minutes;
    // Maximum allowed duration for a project (e.g., 90 days)
    uint256 public immutable MAX_PROJECT_DURATION = 7 days;
    // NEW: Minimum lock duration for liquidity (e.g., 30 days)
    uint256 public constant MIN_LOCK_DURATION = 14 days;
    //  =============================================================================
    //               Constants for consistency with _calculateTokensDue
    //  =============================================================================
    uint256 public constant MIN_TOKEN_PRICE = 1e12;     // 0.000001 in 18 decimals
    uint256 public constant MAX_TOKEN_PRICE = 1e24;     // 1,000,000 in 18 decimals
    uint8 public constant MAX_TOKEN_DECIMALS = 30;
    uint256 public constant PRICE_DECIMALS = 18;
    // timelock constant
    uint256 public constant WITHDRAWAL_DELAY = 1 days;
    //  =============================================================================
    //                State Variables and Contract References 
    //  =============================================================================

    // --- Liquidity Management & Fee State ---
    // Tracks the amount of project tokens deposited by the project owner specifically for liquidity
    mapping(uint256 => uint256) public projectLiquidityTokenDeposits;

    // References to core platform contracts (stored as addresses, cast to interfaces when used)
    address public exhibitionFactory;
    address public exhibitionAMM;

    // References to the faucet-enabled ERC20 token addresses (set by owner functions)
    address public exhTokenAddress;
    address public exUSDTTokenAddress;

    // --- Faucet Settings ---
    uint256 public faucetAmountEXH; // Amount of EXH to dispense per request
    uint256 public faucetAmountUSDT; // Amount of exUSDT to dispense per request
    uint256 public faucetCooldownSeconds; // Cooldown period for faucet requests (in seconds)
    mapping(address => uint256) private lastFaucetRequestTime; // User address => last request timestamp

    // --- Platform-wide Settings ---
    uint256 public platformFeePercentage; // Percentage (e.g., 500 for 5.00%)
    address public platformFeeRecipient;
    mapping(address => uint256) public accumulatedFees; // Token address => accumulated fee amount for each token

    // --- Approved Contribution Tokens ---
    address[] public ExhibitionContributionTokens;
    mapping(address => bool) public isExhibitionContributionToken;

    // --- Launchpad Project Data ---
    // Counter for unique project IDs (private as it's an internal mechanism)
    uint256 private projectIdCounter;
    // Main mapping for all project data (projectId => Project struct)
    mapping(uint256 => Project) public projects;

    // --- Participant-Specific Data Mappings ---
    // Mapping to store individual participant contributions per project
    mapping(uint256 => mapping(address => uint256)) public contributions; // ProjectId => User => amount contributed in contributionToken
    // Mapping to track how much project token each contributor has claimed for a specific project
    // Mapping for participant vesting information: projectId => participantAddress => VestingInfo struct
    mapping(uint256 => mapping(address => VestingInfo)) public vestingInfo;
    // Mapping for tracking refunds (for future refund logic)
    mapping(uint256 => mapping(address => bool)) public hasRefunded; // ProjectId => User => true if refund has been issued

    // --- Events ---
    // Existing Faucet and Factory Events

    event FaucetRequested(address indexed user, uint256 exhAmount, uint256 usdtAmount);
    event FaucetMinted(address indexed user, address indexed token, uint256 amount);
    event TokensDepositedForProject(uint256 indexed projectId, address indexed tokenAddress, uint256 amount, ProjectStatus Status);
    event StandaloneTokenDeployed(
        address indexed deployer,
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 initialSupply,
        string logoURI
    );
    event ExhibitionFactoryAddressSet(address indexed oldAddress, address indexed newAddress);
    event ExhibitionAMMAddressSet(address indexed oldAddress, address indexed newAddress);
    event ProjectStatusUpdated(uint256 indexed projectId, ProjectStatus newStatus);
    event PlatformFeePercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event PlatformFeeRecipientUpdated(address oldRecipient, address newRecipient);
    event FeesWithdrawn(address indexed tokenAddress, address indexed recipient, uint256 amount);
    event ExhibitionContributionTokenAdded(address indexed tokenAddress);
    event ExhibitionContributionTokenRemoved(address indexed tokenAddress);
    event AmmApprovedForToken(address indexed token, address indexed spender, uint256 amount); // If AMM approval is managed here
    event ExhTokenAddressSet(address indexed tokenAddress);
    event ExhibitionUSDTAddressSet(address indexed tokenAddress); 
    event ProjectCreated(
        uint256 indexed projectId,
        address indexed projectOwner,
        address projectToken,
        address contributionTokenAddress,
        uint256 fundingGoal,
        uint256 softCap,
        uint256 totalProjectTokenSupply,
        string  projectTokenLogoURI,
        uint256 amountTokensForSale,
        uint256 liquidityPercentage,
        uint256 lockDuration,
        uint256 startTime,
        uint256 endTime
    );
    event ContributionMade(
        uint256 indexed projectId,
        address indexed contributor,
        uint256 amount,
        address contributionTokenAddress,
        uint256 totalRaised
    );
    event HardCapReached(uint256 indexed projectId, uint256 totalRaised, uint256 hardCap);
    event SoftCapReach(uint256 indexed projectId, uint256 totalRaised, uint256 softCap);
    event ProjectFinalized(
        uint256 indexed projectId,
        ProjectStatus newStatus,
        uint256 totalRaised
    );
    event LiquidityTokensDeposited(
        uint256 indexed projectId,
        address indexed depositor,
        uint256 amount
    );
    event TokensClaimed(
        uint256 indexed projectId,
        address indexed contributor,
        uint256 amountClaimed,
        uint256 totalClaimedForContributor
    );
    event SoftCapNotReach(uint256 indexed projectId, uint256 totalRaised);
    event RefundIssued(
        uint256 indexed projectId,
        address indexed participant,
        uint256 refundedAmount
    );
    event VestingClaimed(
        uint256 indexed projectId,
        address indexed user,
        uint256 amount
    );
    event PlatformFeeCollected(
        uint256 indexed projectId,
        address indexed tokenAddress,
        uint256 amount,
        address indexed recipient
    );
    event LiquidityAdded(
        uint256 indexed projectId,
        address indexed projectOwner,
        uint256 projectTokensAdded,
        uint256 contributionTokensAdded,
        uint256 liquidityMinted
    );
    event FundsReleasedToProjectOwner(
        uint256 indexed projectId,
        address indexed projectOwner,
        uint256 amountReleased,
        ProjectStatus finalStatus
    );
    event UnsoldTokensWithdrawn(uint256 indexed projectId, address indexed projectOwner, uint256 amount);


    // --- Constructor ---
    constructor() Ownable(msg.sender) {}


    // --- Admin Functions (Owner-only) ---
   /**
     * @dev Sets or updates the address of the ExhibitionFactory contract.
     * Can be called multiple times by the owner to update the factory address.
     * @param _exhibitionFactoryAddress The address of the deployed ExhibitionFactory contract.
     */
    function setExhibitionFactoryAddress(address _exhibitionFactoryAddress) external onlyOwner {
        if (_exhibitionFactoryAddress == address(0)) revert ZeroAddress();
    
        address oldFactoryAddress = exhibitionFactory; 
        exhibitionFactory = _exhibitionFactoryAddress;
    
        emit ExhibitionFactoryAddressSet(oldFactoryAddress, _exhibitionFactoryAddress);
    }


    /**
     * @dev Sets or updates the address of the ExhibitionAMM contract.
     * Can be called multiple times by the owner to update the AMM address.
     * @param _exhibitionAMMAddress The address of the deployed ExhibitionAMM contract.
     */
    function setExhibitionAMMAddress(address _exhibitionAMMAddress) external onlyOwner {
        if (_exhibitionAMMAddress == address(0)) revert ZeroAddress();
    
        address oldAMMAddress = exhibitionAMM;
        exhibitionAMM = _exhibitionAMMAddress;
    
        emit ExhibitionAMMAddressSet(oldAMMAddress, _exhibitionAMMAddress);  
    } 

    /**
     * @dev Sets the address of the Exh token contract.
     * This can only be called once, by the owner, after deployment.
     * @param _exhTokenAddress The address of the deployed Exh token contract.
     */
    function setExhTokenAddress(address _exhTokenAddress) external onlyOwner {
        if (_exhTokenAddress == address(0)) revert ZeroAddress(); // Check the address variable
        exhTokenAddress = _exhTokenAddress; // Assign to the address variable
        emit ExhTokenAddressSet(_exhTokenAddress);
    }

    /**
     * @dev Sets the address of the ExhibitionUSDT token contract.
     * This can only be called once, by the owner, after deployment.
     * @param _exUSDTTokenAddress The address of the deployed ExhibitionUSDT token contract.
     */
   function setExUSDTTokenAddress(address _exUSDTTokenAddress) external onlyOwner {
       if (_exUSDTTokenAddress == address(0)) revert ZeroAddress(); // Check the address variable
       exUSDTTokenAddress = _exUSDTTokenAddress; // Assign to the address variable
       emit ExhibitionUSDTAddressSet(_exUSDTTokenAddress);
    }

    /**
     * @dev Returns the address of the wrapped native token (exNEX) as provided by the AMM.
     * Reverts if the AMM address has not been set.
     * @return The address of the exNEX token.
     */
    function getExNEXAddress() external view returns (address) {
        if (exhibitionAMM == address(0)) revert AMMNotSet(); // Ensure AMM is set
        return IExhibitionAMM(exhibitionAMM).exNEX_ADDRESS(); // Query AMM for exNEX address
    }

    /**
     * @dev Sets the amount of EXH tokens to dispense per faucet request.
     * Only the owner can call this.
     * @param _amount The amount of EXH tokens (with 18 decimals) to set.
     */
    function setFaucetAmountEXH(uint256 _amount) public onlyOwner {
        faucetAmountEXH = _amount;
    }

    /**
     * @dev Sets the amount of exUSDT tokens to dispense per faucet request.
     * Only the owner can call this.
     * @param _amount The amount of exUSDT tokens (with 6 decimals) to set.
     */
    function setFaucetAmountUSDT(uint256 _amount) public onlyOwner {
        faucetAmountUSDT = _amount;
    }

    /**
     * @dev Sets the cooldown period (in seconds) for faucet requests.
     * Only the owner can call this.
     * @param _seconds The cooldown period in seconds.
     */
    function setFaucetCooldown(uint256 _seconds) public onlyOwner {
        faucetCooldownSeconds = _seconds;
    }

    /**
     * @dev Sets the platform fee percentage.
     * Only the owner can call this.
     * @param _newPercentage The new fee percentage in basis points (e.g., 500 for 5%).
     */
    function setPlatformFeePercentage(uint256 _newPercentage) public onlyOwner {
        if (_newPercentage > 10000) revert InvalidPercentage(); // Max 100% (10000 basis points)
        emit PlatformFeePercentageUpdated(platformFeePercentage, _newPercentage);
        platformFeePercentage = _newPercentage;
    }

    /**
     * @dev Sets the address to receive platform fees.
     * Only the owner can call this.
     * @param _newRecipient The new address to receive fees.
     */
    function setPlatformFeeRecipient(address _newRecipient) public onlyOwner {
        if (ExLibrary.isZeroAddress(_newRecipient)) revert InvalidInput();
        emit PlatformFeeRecipientUpdated(platformFeeRecipient, _newRecipient);
        platformFeeRecipient = _newRecipient;
    }

    /**
     * @dev Allows the owner to add a token to the list of platform-approved contribution tokens.
     * Only tokens on this list can be specified as _contributionTokenAddress for new projects.
     * @param _tokenAddress The address of the ERC20 token to approve.
     */
    function addExhibitionContributionToken(address _tokenAddress) public onlyOwner {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        if (isExhibitionContributionToken[_tokenAddress]) revert TokenAlreadyApproved(); // Re-using error
        ExhibitionContributionTokens.push(_tokenAddress);
        isExhibitionContributionToken[_tokenAddress] = true;
        emit ExhibitionContributionTokenAdded(_tokenAddress);
    }

    /**
     * @dev Allows the owner to remove a token from the list of platform-approved contribution tokens.
     * @param _tokenAddress The address of the ERC20 token to remove.
     */
    function removeExhibitionContributionToken(address _tokenAddress) public onlyOwner {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        if (!isExhibitionContributionToken[_tokenAddress]) revert TokenNotApproved(); // Re-using error

        isExhibitionContributionToken[_tokenAddress] = false;
        uint256 length = ExhibitionContributionTokens.length;
        for (uint256 i = 0; i < length; i++) { // Changed to uint256 to avoid unchecked arithmetic warning
            if (ExhibitionContributionTokens[i] == _tokenAddress) {
                ExhibitionContributionTokens[i] = ExhibitionContributionTokens[length - 1];
                ExhibitionContributionTokens.pop();
                break;
            }
        }
        emit ExhibitionContributionTokenRemoved(_tokenAddress);
    }
     
    // Import library
    using TokenCalculationLib for *;

    // ========================================
    // INTERFACE IMPLEMENTATION
    // ========================================

    function calculateTokensDue(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress,
        address projectTokenAddress
    ) external view override returns (uint256) {
        return TokenCalculationLib.calculateTokensDue(
            contributorContribution,
            tokenPrice,
            contributionTokenAddress,
            projectTokenAddress
        );
    }

    function getCalculationPreview(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress,
        address projectTokenAddress
    ) external view override returns (CalculationPreview memory) {
        return TokenCalculationLib.getCalculationPreview(
            contributorContribution,
            tokenPrice,
            contributionTokenAddress,
            projectTokenAddress
        );
    }

    function validateCalculation(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress,
        address projectTokenAddress
    ) external view override returns (ValidationResult memory) {
        return TokenCalculationLib.validateCalculation(
            contributorContribution,
            tokenPrice,
            contributionTokenAddress,
            projectTokenAddress
        );
    }

    function getMinimumContribution(
        uint256 tokenPrice,
        address contributionTokenAddress,
        address projectTokenAddress
    ) external view override returns (uint256) {
        return TokenCalculationLib.getMinimumContribution(
            tokenPrice,
            contributionTokenAddress,
            projectTokenAddress
        );
    }

    function getTokenInfo(address tokenAddress) 
        external 
        view 
        override 
        returns (TokenInfo memory) 
    {
        return TokenCalculationLib.getTokenInfo(tokenAddress);
    }

    function batchCalculateTokens(
        uint256[] calldata contributionAmounts,
        uint256 tokenPrice,
        address contributionTokenAddress,
        address projectTokenAddress
    ) external view override returns (uint256[] memory) {
        return TokenCalculationLib.batchCalculateTokens(
            contributionAmounts,
            tokenPrice,
            contributionTokenAddress,
            projectTokenAddress
        );
    }

    function getSystemConstants() 
        external 
        pure
        override 
        returns (SystemConstants memory) 
    {
        return TokenCalculationLib.getSystemConstants();
    }


    /**
     * @dev Allows the owner to withdraw accumulated fees for a specific token.
     * @param _tokenAddress The address of the token for which to withdraw fees.
     * @param _recipient The address to send the fees to.
     */
    function withdrawAccumulatedFees(address _tokenAddress, address _recipient) public onlyOwner nonReentrant {
        if (ExLibrary.isZeroAddress(_recipient)) revert InvalidInput();
        if (accumulatedFees[_tokenAddress] == 0) revert ZeroAmount();

        uint256 amount = accumulatedFees[_tokenAddress];
        accumulatedFees[_tokenAddress] = 0; // Reset before transfer to prevent re-entrancy

        _transferTokens(_tokenAddress, address(this), _recipient, amount);

        emit FeesWithdrawn(_tokenAddress, _recipient, amount);
    }

    /**
     * @dev Allows the owner to approve the ExhibitionAMM contract to spend all
     * platform-approved contribution tokens held by this Exhibition contract.
     * This is necessary for the AMM to pull contribution tokens for initial liquidity.
     * This function should be called by the owner after deployment and after
     * the ExhibitionAMM contract address has been set.
     */
    function approveAmmForContributionTokens() public onlyOwner {
       // Iterate through all currently approved platform contribution tokens
       for (uint256 i = 0; i < ExhibitionContributionTokens.length; i++) {
           address tokenAddress = ExhibitionContributionTokens[i];
           // 🔒 Use SafeERC20 forceApprove for OpenZeppelin v5.x
           IERC20(tokenAddress).forceApprove(address(exhibitionAMM), type(uint256).max);
           emit AmmApprovedForToken(tokenAddress, address(exhibitionAMM), type(uint256).max);
       }
    }

    //  =============================================================================
    //                 Standalone Token Deployment Functionality
    //  =============================================================================
    /**
     * @dev Allows any user to deploy a standalone ERC20 token not associated with a launchpad project.
     * The initial supply of the new token is minted directly to the caller's address,
     * and the caller becomes the Ownable owner of the new token contract.
     * This function uses the ExhibitionFactory to deploy the token.
     * @param _name The name of the new token.
     * @param _symbol The symbol of the new token.
     * @param _initialSupply The total initial supply of the new token.
     * @param _logoURI The URL for the token's logo.
     * @return newTokenAddress The address of the newly deployed token.
     */
    function deployStandaloneToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        string memory _logoURI
    ) public nonReentrant returns (address newTokenAddress) {
        // Ensure ExhibitionFactory is set.
        if (address(exhibitionFactory) == address(0)) {
            revert FactoryNotSet();
        }
        // Ensure initial supply is not zero.
        if (_initialSupply == 0) {
            revert ZeroAmount();
        }

        // Call ExhibitionFactory to create the token.
        // msg.sender becomes the owner of the new token contract and receives its initial supply.
        newTokenAddress = IExhibitionFactory(exhibitionFactory).createToken(_name, _symbol, _initialSupply, _logoURI, msg.sender);
        // Emit an event for off-chain indexing and transparency.
        emit StandaloneTokenDeployed(
            msg.sender,
            newTokenAddress,
            _name,
            _symbol,
            _initialSupply,
            _logoURI
        );
    }

    //  =============================================================================
    //                  Launchpad Project Creation Functionality
    //  =============================================================================
    /**
     * @dev Allows a user to initiate the creation of a new launchpad project (Phase 1).
     * This function deploys a new project token via the ExhibitionFactory,
     * sets up the project's core parameters and vesting schedule.
     * The project will be in 'Upcoming' status.
     * The project owner must later approve tokens for sale, deposit them, and set extra details.
     * @param _projectTokenName The name of the new project token.
     * @param _projectTokenSymbol The symbol of the new project token.
     * @param _initialTotalSupply The total initial supply of the new project token to be minted by the factory.
     * @param _projectTokenLogoURI The URL for the project token's logo.
     * @param _contributionTokenAddress The ERC20 token address used for contributions to this project (must be an approved Exhibition Contribution Token).
     * @param _fundingGoal The hard cap for the project in terms of contribution tokens.
     * @param _softCap The soft cap (minimum funding goal) for the project.
     * @param _minContribution Minimum allowed contribution per participant in contribution tokens.
     * @param _maxContribution Maximum allowed contribution per participant in contribution tokens.
     * @param _tokenPrice The price of 1 project token in contribution tokens (ALWAYS in 18-decimal format, e.g., 0.001 = 1000000000000000).
     * @param _startTime Timestamp when contributions open.
     * @param _endTime Timestamp when contributions close.
     * @param _amountTokensForSale The subset of _initialTotalSupply designated for distribution to contributors.
     * @param _liquidityPercentage The percentage of net raised funds committed to initial liquidity by project creator (e.g., 70-100%).
     * @param _lockDuration Duration in seconds for which the initial liquidity will be locked in the AMM (minimum i4 days).
     * @param _vestingCliff Cliff period in seconds for vesting (0 if no cliff).
     * @param _vestingDuration Total vesting duration in seconds (0 if no vesting).
     * @param _vestingInterval Interval in seconds at which tokens become claimable after cliff (0 if no interval).
     * @param _vestingInitialRelease Percentage (in basis points) released immediately upon claim (0 if no initial release).
     * @param _vestingEnabled True if vesting is enabled for this project.
     * @return projectId The ID of the newly created project.
     * @return projectTokenAddress The address of the newly created project token.
     */
    function createLaunchpadProject(
        // --- Project Token Details (for ExhibitionFactory.createToken) ---
        string memory _projectTokenName,
        string memory _projectTokenSymbol,
        uint256 _initialTotalSupply,
        string memory _projectTokenLogoURI,

        // --- Core Project Parameters (from Project struct) ---
        address _contributionTokenAddress,
        uint256 _fundingGoal,
        uint256 _softCap,
        uint256 _minContribution,
        uint256 _maxContribution,
        uint256 _tokenPrice,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _amountTokensForSale,
        uint256 _liquidityPercentage,
        uint256 _lockDuration,

        // --- Vesting Schedule Parameters (from VestingSchedule struct) ---
        bool _vestingEnabled,
        uint256 _vestingCliff,
        uint256 _vestingDuration,
        uint256 _vestingInterval,
        uint256 _vestingInitialRelease
    ) external nonReentrant returns (uint256 projectId, address projectTokenAddress) {

        // --- Input Validation ---
        if (address(exhibitionFactory) == address(0)) revert FactoryNotSet();
        if (address(exhibitionAMM) == address(0)) revert InvalidInput(); // AMM must be set
        if (_initialTotalSupply == 0) revert ZeroAmount();
        if (_fundingGoal == 0) revert ZeroAmount();
        if (_softCap == 0) revert ZeroAmount();
        if (_softCap > _fundingGoal) revert InvalidInput(); // Soft cap cannot be greater than hard cap
        if (_minContribution == 0) revert ZeroAmount();
        if (_maxContribution == 0) revert ZeroAmount();
        if (_minContribution > _maxContribution) revert InvalidInput(); // Min contribution cannot be greater than max
        _tokenPrice.validateTokenPrice();
        if (_amountTokensForSale == 0) revert ZeroAmount();
        if (_amountTokensForSale > _initialTotalSupply) revert InvalidInput(); // Cannot sell more tokens than total supply

        // Timestamps validation
        if (_startTime == 0 || _endTime == 0) revert InvalidInput();
        if (_startTime >= _endTime) revert InvalidInput(); // End time must be after start time
        if (_startTime < block.timestamp) revert InvalidInput(); // Start time must be in the future

        // Liquidity percentage validation
        if (_liquidityPercentage < ExLibrary.MIN_LIQUIDITY_PERCENTAGE || _liquidityPercentage > ExLibrary.MAX_LIQUIDITY_PERCENTAGE) {
            revert InvalidPercentage();
        }

        // Check if contribution token is approved by the platform
        _checkExhibitionContributionToken(_contributionTokenAddress);

        // Vesting validation
        if (_vestingEnabled) {
            if (_vestingDuration == 0) revert InvalidInput(); // If enabled, duration must be set
            if (_vestingCliff > _vestingDuration) revert InvalidInput(); // Cliff cannot be longer than duration
            if (_vestingInterval == 0 && _vestingDuration > 0) revert InvalidInput(); // If vesting, interval must be set
            if (_vestingInitialRelease > ExLibrary.FEE_DENOMINATOR) revert InvalidPercentage(); // Initial release cannot exceed 100%
        } else {
            // If vesting is not enabled, ensure related parameters are zero to avoid confusion
            if (_vestingCliff != 0 || _vestingDuration != 0 || _vestingInterval != 0 || _vestingInitialRelease != 0) {
                revert InvalidInput();
            }
        }

        // Ensure start time is in the future and adheres to minimum delay
        if  (_startTime <= block.timestamp + MIN_START_DELAY) {
            revert InvalidStartTime();
        }

        // Ensure end time is after start time and within maximum duration
        if  (_endTime <= _startTime) {
            revert InvalidProjectDuration(); // End time must be after start time
        }
        if (_endTime - _startTime > MAX_PROJECT_DURATION) {
            revert InvalidProjectDuration(); // Duration exceeds maximum allowed
        }

        // NEW: Validate lock duration
        if (_lockDuration < MIN_LOCK_DURATION) {
            revert InvalidLockDuration();
        }

        // 1. Increment projectCounter and assign projectId
        projectId = ++projectIdCounter; // Pre-increment to get ID starting from 1

        // 2. Create project token via factory
        // The project creator (msg.sender) becomes the owner of the newly created token.
        // The initialTotalSupply is minted to the project creator.
        address newProjectTokenAddress = IExhibitionFactory(exhibitionFactory).createToken(
            _projectTokenName,
            _projectTokenSymbol,
            _initialTotalSupply,
            _projectTokenLogoURI,
            msg.sender // The project creator is the owner of the new token
        );

        // Basic check to ensure a non-zero address was returned
        if (newProjectTokenAddress == address(0)) revert CallFailed();
        projectTokenAddress = newProjectTokenAddress; // Assign to return variable

        // 3. Populate Project struct
        Project storage newProject = projects[projectId]; // Get a storage reference to the new project
        newProject.projectOwner = msg.sender;
        newProject.projectToken = newProjectTokenAddress;
        newProject.contributionTokenAddress = _contributionTokenAddress;
        newProject.fundingGoal = _fundingGoal;
        newProject.softCap = _softCap;
        newProject.minContribution = _minContribution;
        newProject.maxContribution = _maxContribution;
        newProject.tokenPrice = _tokenPrice;
        newProject.startTime = _startTime;
        newProject.endTime = _endTime;
        newProject.totalRaised = 0; // Initialize total raised to zero
        newProject.totalProjectTokenSupply = _initialTotalSupply;
        newProject.projectTokenLogoURI = _projectTokenLogoURI;
        newProject.amountTokensForSale = _amountTokensForSale;
        newProject.liquidityPercentage = _liquidityPercentage;
        newProject.lockDuration = _lockDuration;
        newProject.status = ProjectStatus.Upcoming; // Initial status
        newProject.liquidityAdded = false; // Initialize liquidity added flag

        // Populate VestingSchedule nested struct
        newProject.vestingEnabled = _vestingEnabled;
        newProject.vestingCliff = _vestingCliff;
        newProject.vestingDuration = _vestingDuration;
        newProject.vestingInterval = _vestingInterval;
        newProject.vestingInitialRelease = _vestingInitialRelease;

        // 4. Emit ProjectCreated event
        emit ProjectCreated(
            projectId,
            msg.sender, // projectOwner
            newProjectTokenAddress,
            _contributionTokenAddress,
            _fundingGoal,
            _softCap,
            _initialTotalSupply, // totalProjectTokenSupply
            _projectTokenLogoURI,
            _amountTokensForSale,
            _liquidityPercentage,
            _lockDuration,
            _startTime,
            _endTime
        );
    }

    //  =============================================================================
    //               Project Token For Sale Deposit Functionality
    //  =============================================================================
    /**
     * @dev Allows the project owner to deposit the tokens designated for sale
     * to the Exhibition contract after the project has been created.
     * This function should be called after the project owner has approved
     * the Exhibition contract to spend their project tokens.
     * @param _projectId The ID of the project to deposit tokens for.
     * @param _amount The amount of project tokens to deposit for sale.
     */
    function depositProjectTokens(uint256 _projectId, uint256 _amount) external nonReentrant {
        // Input validation
        if (_projectId == 0) revert InvalidInput();
        if (_amount == 0) revert ZeroAmount();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound(); // Ensure project exists
        if (project.projectOwner != msg.sender) revert NotProjectOwner(); // Only project owner can deposit

        // Ensure the project is in a state where tokens can be deposited (e.g., Upcoming)
        if (project.status != ProjectStatus.Upcoming) revert InvalidInput(); // Can only deposit for Upcoming projects

        // Check if the deposited amount matches the amountTokensForSale
        // This ensures the project owner deposits the exact amount they committed.
        if (_amount != project.amountTokensForSale) revert InvalidInput(); // Or a more specific error like MismatchedDepositAmount()

        // Transfer tokens from project owner to this contract
        _transferTokens(
            project.projectToken, // The project's own token
            msg.sender,           // From the project owner
            address(this),        // To the Exhibition contract
            _amount               // The amount committed for sale
        );

        // Update project status to Active after tokens are deposited
        // This marks the project as ready to accept contributions (once startTime is reached).
        project.status = ProjectStatus.Active; // Change status to Active

        // Emit an event for project activation/deposit completion
        emit TokensDepositedForProject(_projectId, project.projectToken, project.amountTokensForSale, ProjectStatus.Active);
    }

    //  =============================================================================
    //                 Project Contribution Functionality
    //  =============================================================================
    /**
     * @dev Allows a user to contribute to an active launchpad project.
     * If the contribution causes the project to reach its funding goal (hard cap),
     * the project's status is immediately set to Successful.
     * @param _projectId The ID of the project to contribute to.
     * @param _amount The amount of contribution tokens to contribute.
     */
    function contribute(uint256 _projectId, uint256 _amount) external nonReentrant {
        // Input validation
        if (_projectId == 0) revert InvalidInput();
        if (_amount == 0) revert ZeroAmount();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound(); // Ensure project exists

        // Project owner cannot contribute to their own project
        if (project.projectOwner == msg.sender) revert CannotContributeToOwnProject();

        // Check project status: Must be Active (1) to accept contributions
        // Cannot contribute if already FundingEnded, Successful, Failed, Claimable, Refundable, or Completed.
        if (project.status != ProjectStatus.Active) revert ProjectNotActive();

        // Check contribution time window
        if (block.timestamp < project.startTime) revert InvalidInput(); // Contributions have not started yet
        if (block.timestamp >= project.endTime) revert InvalidInput(); // Contributions have ended

        // Calculate potential new total contribution for the participant
        uint256 currentContribution = contributions[_projectId][msg.sender];
        uint256 newTotalContribution = currentContribution + _amount;

        // Check min/max contribution per participant
        if (newTotalContribution < project.minContribution) revert ContributionTooLow(); // New total must meet min
        if (newTotalContribution > project.maxContribution) revert ExceedsMaxContribution(); // New total must not exceed max

        // Check if this contribution would exceed the funding goal (hard cap)
        // This check ensures we don't overfund beyond the hard cap.
        if (project.totalRaised + _amount > project.fundingGoal) revert FundingGoalExceeded();

        // 🔒 CEI PATTERN: UPDATE STATE BEFORE EXTERNAL CALLS
        // Update state variables FIRST before any external interactions
        uint256 newTotalRaised = project.totalRaised + _amount;
        project.totalRaised = newTotalRaised;
        contributions[_projectId][msg.sender] = newTotalContribution;

        // 🔒 Use SafeERC20 for token transfer
        // Transfer contribution tokens from contributor to this contract
        IERC20(project.contributionTokenAddress).safeTransferFrom(
            msg.sender,      // From the contributor
            address(this),   // To the Exhibition contract
            _amount          // The amount to contribute
        );

        //  =============================================================================
        //                 INSTANT HARD CAP FINALIZATION LOGIC
        //  =============================================================================
        // If this contribution causes the project to reach or exceed its funding goal (hard cap),
        // the project is instantly successful.
        if (newTotalRaised >= project.fundingGoal) {
            project.status = ProjectStatus.Successful; // <--- Set to Successful directly (enum value 3)

            // --- Emit events ---
            emit ContributionMade(_projectId, msg.sender, _amount, project.contributionTokenAddress, newTotalRaised);
            emit HardCapReached(_projectId, newTotalRaised, project.fundingGoal);
            emit ProjectFinalized(_projectId, ProjectStatus.Successful, newTotalRaised);
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Successful);
            return; // Exit the function immediately as the project is now finalized
        }

        // If hard cap is NOT reached, emit contribution event
        emit ContributionMade(_projectId, msg.sender, _amount, project.contributionTokenAddress, newTotalRaised);
    }

    //  =============================================================================
    //                   Finalizes Project Functionality
    //  =============================================================================
    /**
     * @dev Finalizes a project after its funding period has ended by time.
     * Determines if the project is successful (soft cap met) or failed (soft cap not met).
     * Can be called by anyone *after* the project's endTime has passed.
     * This function is specifically for projects that did NOT reach hard cap during the active period.
     * @param _projectId The ID of the project to finalize.
     */
    function finalizeProject(uint256 _projectId) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound(); // Ensure project exists

        // This function is intended for projects that have reached their endTime
        // but have NOT yet reached hard cap (and thus are still in 'Active' status).
        // It cannot be called on projects that are already in a terminal state (Successful, Failed, Claimable, Refundable, Completed)
        // or projects that are still Upcoming.
        if (project.status != ProjectStatus.Active) {
            revert InvalidProjectStatus(); // Project not in 'Active' state to be finalized by time
        }

        // Check if funding period has actually ended by time
        if (block.timestamp < project.endTime) {
            revert FundingPeriodNotEnded(); // Cannot finalize before end time
        }

        // Transition to FundingEnded first (as per enum definition)
        project.status = ProjectStatus.FundingEnded; // <--- Transition to FundingEnded (enum value 2)
        emit ProjectStatusUpdated(_projectId, ProjectStatus.FundingEnded);

        // Determine final outcome based on soft cap
        if (project.totalRaised >= project.softCap) {
            project.status = ProjectStatus.Successful; // <--- Then to Successful (enum value 3)
            // --- Emit events ---
            emit ProjectFinalized(_projectId, ProjectStatus.Successful, project.totalRaised);
            emit SoftCapReach(_projectId, project.totalRaised, project.softCap);
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Successful);
        } else {
            // Soft cap not met
            project.status = ProjectStatus.Failed; // <--- Then to Failed (enum value 4)
              
            emit ProjectFinalized(_projectId, ProjectStatus.Failed, project.totalRaised);
            emit SoftCapNotReach(_projectId, project.totalRaised);
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Failed);
        }
    }

    //  =============================================================================
    //                       Claiming Functionality
    //  =============================================================================
    /**
     * @dev Calculates the total amount of tokens that *should be* vested to date for a contributor
     * based on the project's vesting schedule rules. This does not consider already claimed amounts.
     * @param _project The Project struct.
     * @param _totalTokensDue The total amount of project tokens this contributor is owed.
     * @return The total amount of tokens that are currently vested for this contributor.
     */
    function _calculateAvailableVestingAmount(
        Project storage _project,
        uint256 _totalTokensDue
    ) private view returns (uint256) {
        // If project-level vesting is not enabled, all tokens are available immediately
        if (!_project.vestingEnabled) {
            return _totalTokensDue;
        }

        uint256 currentTime = block.timestamp;
        uint256 projectStartTime = _project.startTime; // Project start time is the base for vesting

        uint256 vestingCliffTime = projectStartTime + _project.vestingCliff;
        uint256 vestingEndTime = projectStartTime + _project.vestingDuration;

        // Calculate initial release amount
        uint256 initialReleaseAmount = (_totalTokensDue * _project.vestingInitialRelease) / 10000; // 10000 for 100% with 2 decimal places

        // If before cliff, only initial release is available
        if (currentTime < vestingCliffTime) {
            return initialReleaseAmount;
        }

        // If after vesting end time, all remaining tokens are vested
        if (currentTime >= vestingEndTime) {
            return _totalTokensDue;
        }

        // Calculate vested amount based on linear vesting after initial release and cliff
        uint256 timeElapsedAfterCliff = currentTime - vestingCliffTime;
        uint256 vestingPeriodAfterCliff = _project.vestingDuration - _project.vestingCliff;

        // Avoid division by zero if vestingPeriodAfterCliff is 0 (should ideally be prevented by validation during project creation)
        if (vestingPeriodAfterCliff == 0) {
            return _totalTokensDue; // Fallback: if duration <= cliff, all tokens effectively vest at cliff
        }

        // Tokens that vest linearly after initial release
        uint256 remainingTokensToVestLinearly = _totalTokensDue - initialReleaseAmount;
        uint256 vestedLinearAmount = (remainingTokensToVestLinearly * timeElapsedAfterCliff) / vestingPeriodAfterCliff;

        // The total vested amount is the initial release plus the linear portion
        uint256 totalVested = initialReleaseAmount + vestedLinearAmount;
        if (totalVested > _totalTokensDue) {
            totalVested = _totalTokensDue; // Cap at total due
        }

        return totalVested;
    }


    /**
     * @dev Allows a contributor to claim their project tokens from a successful project.
     * Tokens are released based on the project's vesting schedule.
     * @param _projectId The ID of the project to claim tokens from.
     */
    function claimTokens(uint256 _projectId) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();

        uint256 contributorContribution = contributions[_projectId][msg.sender];
        if (contributorContribution == 0) revert NoContributionFound();

        // Calculate total project tokens due to this contributor
        // This calculation needs to be robust to decimals.
        // Dynamic decimal calculation
        uint256 totalTokensDue = TokenCalculationLib.calculateTokensDue(
            contributorContribution,
            project.tokenPrice,
            project.contributionTokenAddress,
            project.projectToken
        );

        VestingInfo storage userVestingInfo = vestingInfo[_projectId][msg.sender];

        // Initialize VestingInfo for the user if this is their first claim
        if (userVestingInfo.totalAmount == 0) { // Only initialize if not already initialized
            userVestingInfo.totalAmount = totalTokensDue;
            userVestingInfo.releasedAmount = 0; // Ensure it's 0 initially
            userVestingInfo.lastClaimTime = project.startTime; // Set to project start for initial vesting calculation
            userVestingInfo.nextClaimTime = project.startTime + project.vestingInterval; // Initial next claim time
        }

        // Calculate the total amount that *should be* vested to date based on project rules
        uint256 totalVestedToDate = _calculateAvailableVestingAmount(project, totalTokensDue);

        // The amount available for this specific claim is totalVestedToDate minus what's already claimed
        uint256 amountToTransfer = totalVestedToDate - userVestingInfo.releasedAmount;

        if (amountToTransfer == 0) {
            revert NoTokensCurrentlyVested(); // No new tokens vested since last claim or no tokens vested yet
        }

        // Project must be in Successful, Claimable, or Completed status to allow claims
        if (project.status != ProjectStatus.Successful &&
            project.status != ProjectStatus.Claimable &&
            project.status != ProjectStatus.Completed 
        ) {
            revert InvalidProjectStatus();
        }

        // Transfer project tokens from this contract to the contributor
        _transferTokens(
            project.projectToken,
            address(this),
            msg.sender,
            amountToTransfer
        );

        // Update user's vesting info
        userVestingInfo.releasedAmount += amountToTransfer;
        userVestingInfo.lastClaimTime = block.timestamp; // Update last claim time to now
        // nextClaimTime can be dynamically calculated, not strictly necessary to store if interval is fixed.

        emit TokensClaimed(_projectId, msg.sender, amountToTransfer, userVestingInfo.releasedAmount);
    }
    
    //  =============================================================================
    //                         Refund Functionality 
    //  =============================================================================
    /**
     * @dev Allows a contributor to request a refund for their contribution to a failed project.
     * @param _projectId The ID of the project to request a refund from.
     */
    function requestRefund(uint256 _projectId) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound(); // Ensure project exists

        // Project must be in Failed or Refundable status to allow refunds
        if (project.status != ProjectStatus.Failed && project.status != ProjectStatus.Refundable) {
            revert ProjectNotRefundable();
        }

        // Get contributor's total contribution
        uint256 contributorContribution = contributions[_projectId][msg.sender];
        if (contributorContribution == 0) revert NoContributionToRefund(); // Contributor has nothing to refund

        // Check if user has already been refunded
        if (hasRefunded[_projectId][msg.sender]) {
            revert AlreadyRefunded();
        }

        // If project status is Failed, transition it to Refundable on the first refund
        if (project.status == ProjectStatus.Failed) {
            project.status = ProjectStatus.Refundable;
            emit ProjectStatusUpdated(_projectId, ProjectStatus.Refundable);
        }

        // Transfer contribution tokens back to the contributor
        _transferTokens(
            project.contributionTokenAddress, // The token used for contribution (e.g.,EXH, exUSDT, exNEX)
            address(this),                   // From the Exhibition contract
            msg.sender,                      // To the contributor
            contributorContribution          // The full amount contributed
        );

        // Mark user as refunded
        hasRefunded[_projectId][msg.sender] = true;

        emit RefundIssued(_projectId, msg.sender, contributorContribution);
    }
    
    //  =============================================================================
    //                        Project Liquidity Deposit
    //  =============================================================================
    /**
     * @dev Allows the project owner to deposit their project tokens specifically for the AMM liquidity pool.
     * This must be done after the project is successful and before calling finalizeLiquidityAndReleaseFunds.
     * @param _projectId The ID of the project.
     * @param _amount The amount of project tokens to deposit for liquidity.
     */
    function depositLiquidityTokens(uint256 _projectId, uint256 _amount) external nonReentrant {
        if (_projectId == 0 || _amount == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();

        // Only the project owner can deposit liquidity tokens
        if (msg.sender != project.projectOwner) revert NotProjectOwner();

        // Project must be in Successful status (or Claimable, if you allow claims before this)
        if (project.status != ProjectStatus.Successful && project.status != ProjectStatus.Claimable) {
            revert InvalidProjectStatus();
        }

        // Liquidity must not have been added already
        if (project.liquidityAdded) {
            revert LiquidityAlreadyAdded();
        }

        // Calculate required liquidity amount (same logic as in finalizeLiquidityAndReleaseFunds)
        uint256 totalContributionTokensRaised = project.totalRaised;
        uint256 platformFeeAmount = (totalContributionTokensRaised * platformFeePercentage) / 10000;
        uint256 netRaisedAfterFee = totalContributionTokensRaised - platformFeeAmount;
        uint256 contributionTokensForLiquidity = (netRaisedAfterFee * project.liquidityPercentage) / 10000;

        uint256 requiredProjectTokensForLiquidity =  TokenCalculationLib.calculateTokensDue(
            contributionTokensForLiquidity,
            project.tokenPrice,
            project.contributionTokenAddress,
            project.projectToken
        );

        //Check if total deposits (including this one) would exceed required amount
        if (projectLiquidityTokenDeposits[_projectId] + _amount > requiredProjectTokensForLiquidity) {
            revert ExcessiveLiquidityDeposit();
        }

        // Transfer project tokens from owner to this contract
        _transferTokens(
            project.projectToken,
            msg.sender,
            address(this),
            _amount
        );

        // Update the mapping for liquidity token deposits
        projectLiquidityTokenDeposits[_projectId] += _amount;
    }
    


    //  =============================================================================
    //                    Liquidity Finality To Release Raised Fund
    //  =============================================================================
    /**
     * @dev Allows the project owner to finalize liquidity provision and release remaining funds.
     * This function is callable after the project is successful and the project owner
     * has deposited sufficient project tokens for liquidity via `depositLiquidityTokens`.
     * It handles platform fee collection, AMM liquidity addition (via addLiquidityWithLock),
     * and fund release to the owner.
     * @param _projectId The ID of the successful project.
     *
     * @dev Updated finalizeLiquidityAndReleaseFunds function with proper token approvals
     * Ensure Exhibition contract approves AMM to spend tokens before calling addLiquidityWithLock
     */
    function finalizeLiquidityAndReleaseFunds(uint256 _projectId) external nonReentrant {
        if (_projectId == 0) revert InvalidInput();

        Project storage project = projects[_projectId];
        if (project.projectOwner == address(0)) revert ProjectNotFound();

        // Only the project owner can call this
        if (msg.sender != project.projectOwner) revert NotProjectOwner();

        // Project must be in Successful status to proceed
        if (project.status != ProjectStatus.Successful) {
            revert ProjectNotSuccessfulForLiquidity();
        }

        // Liquidity must not have been added already
        if (project.liquidityAdded) {
            revert LiquidityAlreadyAdded();
        }

        // Ensure AMM and platform fee recipient are set
        if (exhibitionAMM == address(0)) revert AMMNotSet();
        if (platformFeeRecipient == address(0)) revert PlatformFeeRecipientNotSet();

        // --- 1. Calculate and Collect Platform Fee ---
        uint256 totalContributionTokensRaised = project.totalRaised;
        uint256 platformFeeAmount = (totalContributionTokensRaised * platformFeePercentage) / 10000;
        uint256 netRaisedAfterFee = totalContributionTokensRaised - platformFeeAmount;

        // Transfer platform fee to the recipient
        if (platformFeeAmount > 0) {
            _transferTokens(
                project.contributionTokenAddress,
                address(this),
                platformFeeRecipient,
                platformFeeAmount
            );
            accumulatedFees[project.contributionTokenAddress] += platformFeeAmount;
            emit PlatformFeeCollected(_projectId, project.contributionTokenAddress, platformFeeAmount, platformFeeRecipient);
        }

        // --- 2. Calculate Liquidity Amounts and Verify Deposit ---
        uint256 contributionTokensForLiquidity = (netRaisedAfterFee * project.liquidityPercentage) / 10000;

        // Calculate REQUIRED project tokens for liquidity pool based on tokenPrice
        uint256 requiredProjectTokensForLiquidity = TokenCalculationLib.calculateTokensDue(
            contributionTokensForLiquidity,
            project.tokenPrice,
            project.contributionTokenAddress,
            project.projectToken
        );

        // Check if the owner has deposited enough project tokens for liquidity
        if (projectLiquidityTokenDeposits[_projectId] < requiredProjectTokensForLiquidity) {
            revert InsufficientLiquidityTokensDeposited();
        }

        // FIXED: Approve AMM to spend tokens from Exhibition contract (not external EOA)
        // The tokens are already in the Exhibition contract, so we approve AMM to spend them
        IERC20(project.projectToken).approve(exhibitionAMM, requiredProjectTokensForLiquidity);
        IERC20(project.contributionTokenAddress).approve(exhibitionAMM, contributionTokensForLiquidity);

        // --- Call AMM's addLiquidityWithLock function ---
        uint256 actualAmountA;
        uint256 actualAmountB;
        uint256 actualLiquidityMinted;

        uint256 deadline = block.timestamp + 3600; // 1 hour from now

        // Use the new addLiquidityWithLock function to enforce the lock
        (actualAmountA, actualAmountB, actualLiquidityMinted) = IExhibitionAMM(exhibitionAMM).addLiquidityWithLock(
            project.projectToken,                   // tokenA (project token)
            project.contributionTokenAddress,       // tokenB (contribution token)
            requiredProjectTokensForLiquidity,     // amountADesired
            contributionTokensForLiquidity,        // amountBDesired
            requiredProjectTokensForLiquidity,     // amountAMin (no slippage for initial add)
            contributionTokensForLiquidity,        // amountBMin (no slippage for initial add)
            project.projectOwner,                  // LP tokens go to project owner (and get locked)
            deadline,                              // deadline
            _projectId,                           // projectId for lock tracking
            project.lockDuration                  // lock duration from project settings
        );

        // --- 3. Release Remaining Funds to Project Owner ---
        uint256 remainingContributionTokensForOwner = netRaisedAfterFee - contributionTokensForLiquidity;

        // Transfer remaining contribution tokens to the project owner
        if (remainingContributionTokensForOwner > 0) {
            _transferTokens(
                project.contributionTokenAddress,
                address(this),
                project.projectOwner,
                remainingContributionTokensForOwner
            );
            emit FundsReleasedToProjectOwner(_projectId, project.projectOwner, remainingContributionTokensForOwner, ProjectStatus.Completed);
        }

        // Mark liquidity as added
        project.liquidityAdded = true;

        // Update project status to Completed
        project.status = ProjectStatus.Completed;
        emit ProjectStatusUpdated(_projectId, ProjectStatus.Completed);

        // Emit LiquidityAdded event with actual amounts returned by AMM
        emit LiquidityAdded(_projectId, project.projectOwner, actualAmountA, actualAmountB, actualLiquidityMinted);
    }

    //  =============================================================================
    //                      Withdraw Unsold Tokens
    //  =============================================================================
    function withdrawUnsoldTokens(uint256 _projectId) external nonReentrant {
        Project storage project = projects[_projectId];
  
        // Check if caller is the project owner
        if (msg.sender != project.projectOwner) revert Unauthorized();

        // Check if project is Failed/Refundable or hard cap not reached
        if (!(
            project.status == ProjectStatus.Failed ||
            project.status == ProjectStatus.Refundable ||
            project.totalRaised < project.fundingGoal
        )) revert InvalidProjectStatus();

        // Prevent withdrawal during Upcoming or Active
        if (project.status == ProjectStatus.Upcoming || project.status == ProjectStatus.Active) {
           revert InvalidProjectStatus();
        }

        if (block.timestamp < project.endTime + WITHDRAWAL_DELAY) revert WithdrawalLocked();

        uint256 unsoldTokens;
    
        if (project.status == ProjectStatus.Failed || project.status == ProjectStatus.Refundable) {
            // For failed/refundable projects, return all tokens held by the contract
            unsoldTokens = IERC20(project.projectToken).balanceOf(address(this));
        } else {
            // For projects that reach soft cap, calculate tokens allocated vs tokens for sale
            // Use TokenCalculationLib for consistent calculation logic
        
            // First validate the calculation parameters
            ITokenCalculation.ValidationResult memory validation = TokenCalculationLib.validateCalculation(
                project.totalRaised,
                project.tokenPrice,
                project.contributionTokenAddress,
                project.projectToken
            );
        
            if (!validation.isValid) {
                // If validation fails, fall back to contract balance approach
                unsoldTokens = IERC20(project.projectToken).balanceOf(address(this));
            } else {
                // Calculate tokens that should have been allocated based on total raised
                uint256 tokensAllocated = TokenCalculationLib.calculateTokensDue(
                    project.totalRaised,
                    project.tokenPrice,
                    project.contributionTokenAddress,
                    project.projectToken
                );
            
                // Ensure we don't have an invalid state where allocated exceeds tokens for sale
                if (project.amountTokensForSale < tokensAllocated) {
                    revert InvalidTokenAllocation();
                }
            
                // Calculate unsold tokens
                unsoldTokens = project.amountTokensForSale - tokensAllocated;
            }
        }

        if (unsoldTokens == 0) revert NoUnsoldTokens();

        // Verify contract has sufficient token balance
        uint256 contractBalance = IERC20(project.projectToken).balanceOf(address(this));
        if (contractBalance < unsoldTokens) revert InsufficientTokenBalance();

        // Reset amountTokensForSale to prevent re-withdrawal
        project.amountTokensForSale = 0;

        // 🔒 Use SafeERC20 for token transfer
        IERC20(project.projectToken).safeTransfer(project.projectOwner, unsoldTokens);

        // Emit event to log the withdrawal
        emit UnsoldTokensWithdrawn(_projectId, project.projectOwner, unsoldTokens);
    }

    //  =============================================================================
    //                       Faucet Functionality
    //  =============================================================================
    /**
     * @dev Allows users to request testnet EXH and exUSDT tokens from the faucet.
     * Subject to a cooldown period to prevent abuse.
     * This function assumes that the Exhibition.sol contract has been set as the owner
     * of the Exh and ExhibitionUSDT token contracts, and has permission to mint.
     */
    function requestFaucetTokens() public nonReentrant {
        // Ensure tokens are set and amounts are configured
        // Check if at least one token address is set
        if (exhTokenAddress == address(0) && exUSDTTokenAddress == address(0)) { // Use address variables
            revert FaucetNotConfigured();
        }

        // Check cooldown 🔒
        if (faucetCooldownSeconds > 0 && lastFaucetRequestTime[msg.sender] + faucetCooldownSeconds > block.timestamp) {
            revert FaucetCooldownActive();
        }

        // Mint EXH tokens if amount is set 🔒
        if (faucetAmountEXH > 0) {
            // Ensure token contract is set
            if (exhTokenAddress == address(0)) revert FaucetAmountNotSet(); // Use address variable
            IExh(exhTokenAddress).mint(msg.sender, faucetAmountEXH); // Cast address to interface and call mint
            emit FaucetMinted(msg.sender, exhTokenAddress, faucetAmountEXH); // Use address variable for event
        }

        // Mint exUSDT tokens if amount is set 🔒
        if (faucetAmountUSDT > 0) {
            // Ensure token contract is set
            if (exUSDTTokenAddress == address(0)) revert FaucetAmountNotSet(); // <--- CHANGED: Use address variable
            IExhibitionUSDT(exUSDTTokenAddress).mint(msg.sender, faucetAmountUSDT); // <--- CHANGED: Cast address to interface and call mint
            emit FaucetMinted(msg.sender, exUSDTTokenAddress, faucetAmountUSDT); // <--- CHANGED: Use address variable for event
        }

        // Update last request time for cooldown
        lastFaucetRequestTime[msg.sender] = block.timestamp;


        emit FaucetRequested(msg.sender, faucetAmountEXH, faucetAmountUSDT);
    }

    /**
     * @dev Returns the timestamp of the last faucet request for a given user.
     * @param _user The address of the user.
     * @return The timestamp of the last request.
     */
    function lastFaucetRequest(address _user) external view returns (uint256) {
        return lastFaucetRequestTime[_user];
    }
     
    //  =============================================================================
    //                       Internal Helper Functions
    //  =============================================================================
    /**
     * @dev Internal function to transfer tokens. Handles both transfers from the contract's balance
     * and transfers from an approved external address's balance. All tokens are treated as ERC20 tokens.
     * 🔒 Now uses SafeERC20 for all token operations
     * @param _tokenAddress The address of the token to transfer (ERC20 contract address).
     * @param _from The address to transfer tokens from. Can be `address(this)` (contract's balance)
     * or an external address (requiring prior approval for `transferFrom`).
     * @param _to The address to transfer tokens to.
     * @param _amount The amount of tokens to transfer.
     */
    function _transferTokens(address _tokenAddress, address _from, address _to, uint256 _amount) internal {
        if (_amount == 0) return;
        if (ExLibrary.isZeroAddress(_to)) revert InvalidInput();

        if (_from == address(this)) {
            // 🔒 Use SafeERC20 for transfer
            IERC20(_tokenAddress).safeTransfer(_to, _amount);
        } else {
            // 🔒 Use SafeERC20 for transferFrom
            IERC20(_tokenAddress).safeTransferFrom(_from, _to, _amount);
        }
    }

    /**
     * @dev Internal function to approve a spender to spend tokens from this contract's balance.
     * 🔒 Now uses SafeERC20 forceApprove for OpenZeppelin v5.x compatibility
     * @param _tokenAddress The address of the ERC20 token.
     * @param _spender The address of the spender to approve.
     * @param _amount The amount to approve.
     */
    function _approveTokens(address _tokenAddress, address _spender, uint256 _amount) internal {
        if (_tokenAddress == address(0)) revert InvalidInput(); // Basic check
        // 🔒 Use SafeERC20 forceApprove for OpenZeppelin v5.x
        IERC20(_tokenAddress).forceApprove(_spender, _amount);
    }

    /**
     * @dev Internal function to check if a token is approved as an Exhibition contribution token.
     * Reverts if the token is not approved for this purpose.
     * @param _tokenAddress The address of the token to check.
     */
    function _checkExhibitionContributionToken(address _tokenAddress) internal view {
       if (_tokenAddress == address(0)) revert ZeroAddress();
       if (!isExhibitionContributionToken[_tokenAddress]) revert TokenNotApprovedAsExhibitionContributionToken();
    }

    //  =========================================================================
    //                          VIEW/GETTER FUNCTIONS
    //  =========================================================================
    /**
     * @dev Returns the total number of projects created
     */
    function getProjectCount() external view returns (uint256) {
        return projectIdCounter;
    }

    /**
     * @dev Returns a paginated list of project IDs
     * @param offset Starting index
     * @param limit Maximum number of projects to return
     */
    function getProjects(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256 total = projectIdCounter;
        if (offset >= total) return new uint256[](0);
    
        uint256 end = offset + limit;
        if (end > total) end = total;
    
        uint256[] memory projectIds = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            projectIds[i - offset] = i + 1; // Projects start from ID 1
        }
        return projectIds;
    }

    /**
     * @dev Returns all project IDs owned by a specific address
     */
    function getProjectsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 count = 0;
    
        // First pass: count projects
        for (uint256 i = 1; i <= projectIdCounter; i++) {
            if (projects[i].projectOwner == owner) {
                count++;
            }
        }
    
        // Second pass: collect project IDs
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

    /**
     * @dev Returns all project IDs with a specific status
     */
    function getProjectsByStatus(ProjectStatus status) external view returns (uint256[] memory) {
        uint256 count = 0;
    
        // First pass: count projects
        for (uint256 i = 1; i <= projectIdCounter; i++) {
            if (projects[i].status == status) {
                count++;
            }
        }
    
        // Second pass: collect project IDs
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

    /**
     * @dev Returns a user's contribution amount for a specific project
     */
    function getUserContribution(uint256 projectId, address user) external view returns (uint256) {
        return contributions[projectId][user];
    }

    /**
     * @dev Returns comprehensive vesting information for a user
     */
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
    
        // Calculate available amount for claiming
        if (totalAmount > 0) {
            uint256 totalVested = _calculateAvailableVestingAmount(project, totalAmount);
            availableAmount = totalVested > releasedAmount ? totalVested - releasedAmount : 0;
        } else {
            // Calculate if user has contributed but hasn't claimed yet
            uint256 contributorContribution = contributions[projectId][user];
            if (contributorContribution > 0) {
                uint256 totalTokensDue = TokenCalculationLib.calculateTokensDue(
                    contributorContribution,
                    project.tokenPrice,
                    project.contributionTokenAddress,
                    project.projectToken
                );
                uint256 totalVested = _calculateAvailableVestingAmount(project, totalTokensDue);
                availableAmount = totalVested;
            } else {
                availableAmount = 0;
            }
        }
    }

    /**
     * @dev Checks if a user has been refunded for a project
     */
    function hasUserBeenRefunded(uint256 projectId, address user) external view returns (bool) {
        return hasRefunded[projectId][user];
    }

    /**
     * @dev Returns project funding progress as a percentage (in basis points)
     */
    function getProjectProgress(uint256 projectId) external view returns (uint256 progressPercentage) {
        Project storage project = projects[projectId];
        if (project.fundingGoal == 0) return 0;
    
        progressPercentage = (project.totalRaised * 10000) / project.fundingGoal; // In basis points
        if (progressPercentage > 10000) progressPercentage = 10000; // Cap at 100%
    }

    /**
     * @dev Returns time remaining until project end (0 if ended)
     */
    function getProjectTimeRemaining(uint256 projectId) external view returns (uint256 timeRemaining) {
        Project storage project = projects[projectId];
    
        if (block.timestamp >= project.endTime) {
            return 0;
        }
    
        return project.endTime - block.timestamp;
    }

    /**
     * @dev Checks if a project can currently accept contributions
     */
    function canAcceptContributions(uint256 projectId) external view returns (bool) {
        Project storage project = projects[projectId];
    
        return project.status == ProjectStatus.Active &&
        block.timestamp >= project.startTime &&
        block.timestamp < project.endTime &&
        project.totalRaised < project.fundingGoal;
    }

    /**
     * @dev Returns the amount of liquidity tokens deposited for a project
     */
    function getProjectLiquidityDeposit(uint256 projectId) external view returns (uint256) {
        return projectLiquidityTokenDeposits[projectId];
    }

    /**
     * @dev Calculates required liquidity tokens for a project
     */
    function getRequiredLiquidityTokens(uint256 projectId) external view returns (uint256) {
        Project storage project = projects[projectId];
    
        if (project.totalRaised == 0) return 0;
    
        uint256 platformFeeAmount = (project.totalRaised * platformFeePercentage) / 10000;
        uint256 netRaisedAfterFee = project.totalRaised - platformFeeAmount;
        uint256 contributionTokensForLiquidity = (netRaisedAfterFee * project.liquidityPercentage) / 10000;
    
        return TokenCalculationLib.calculateTokensDue(
            contributionTokensForLiquidity,
            project.tokenPrice,
            project.contributionTokenAddress,
            project.projectToken
        );
    }

    /**
     * @dev Returns all approved contribution tokens
     */
    function getExhibitionContributionTokens() external view returns (address[] memory) {
        return ExhibitionContributionTokens;
    }

    /**
     * @dev Returns platform configuration settings
     */
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

    /**
     * @dev Returns the minimum lock duration requirement
     */
    function getMinLockDuration() external pure returns (uint256) {
        return MIN_LOCK_DURATION;
    }

    /**
     * @dev Returns faucet configuration
     */
    function getFaucetSettings() external view returns (
        uint256 exhAmount,
        uint256 usdtAmount,
        uint256 cooldownSeconds
    ) {
        return (faucetAmountEXH, faucetAmountUSDT, faucetCooldownSeconds);
    }

    /**
     * @dev Returns comprehensive project information in a single call
     */
    function getProjectDetails(uint256 projectId) external view returns (
        Project memory project,
        uint256 progressPercentage,
        uint256 timeRemaining,
        bool canContribute,
        uint256 requiredLiquidityTokens,
        uint256 depositedLiquidityTokens
    ) {
        project = projects[projectId];
    
        // Calculate progress percentage
        if (project.fundingGoal > 0) {
            progressPercentage = (project.totalRaised * 10000) / project.fundingGoal;
            if (progressPercentage > 10000) progressPercentage = 10000;
        } else {
            progressPercentage = 0;
        }
    
        // Calculate time remaining
        if (block.timestamp >= project.endTime) {
            timeRemaining = 0;
        } else {
            timeRemaining = project.endTime - block.timestamp;
        }
    
        // Check if can accept contributions
        canContribute = project.status == ProjectStatus.Active &&
        block.timestamp >= project.startTime &&
        block.timestamp < project.endTime &&
        project.totalRaised < project.fundingGoal;
    
        // Calculate required liquidity tokens
        if (project.totalRaised > 0) {
            uint256 platformFeeAmount = (project.totalRaised * platformFeePercentage) / 10000;
            uint256 netRaisedAfterFee = project.totalRaised - platformFeeAmount;
            uint256 contributionTokensForLiquidity = (netRaisedAfterFee * project.liquidityPercentage) / 10000;
        
            requiredLiquidityTokens = TokenCalculationLib.calculateTokensDue(
                contributionTokensForLiquidity,
                project.tokenPrice,
                project.contributionTokenAddress,
                project.projectToken
            );
        } else {
            requiredLiquidityTokens = 0;
        }
    
        // Get deposited liquidity tokens
        depositedLiquidityTokens = projectLiquidityTokenDeposits[projectId];
    }

    /**
     * @dev Returns user's participation summary for a project
     */
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
                project.contributionTokenAddress,
                project.projectToken
            );
        
            VestingInfo storage vesting = vestingInfo[projectId][user];
            tokensClaimed = vesting.releasedAmount;
        
            if (project.status == ProjectStatus.Successful || 
                project.status == ProjectStatus.Claimable || 
                project.status == ProjectStatus.Completed) {
            
                tokensVested = _calculateAvailableVestingAmount(project, tokensOwed);
                tokensAvailable = tokensVested > tokensClaimed ? tokensVested - tokensClaimed : 0;
                canClaim = tokensAvailable > 0;
            }
        }
    }

    /**
     * @dev Returns contract addresses for frontend integration
     */
    function getContractAddresses() external view returns (
        address factory,
        address amm,
        address exhToken,
        address exUSDTToken
    ) {
        return (
            exhibitionFactory,
            exhibitionAMM,
            exhTokenAddress,
            exUSDTTokenAddress
        );
    }


    // Fallback function to reject direct native ETH sends to this contract.
    receive() external payable {
        revert Unauthorized();
    }
}