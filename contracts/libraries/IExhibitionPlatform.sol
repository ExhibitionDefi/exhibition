// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

// =============================================================================
// CUSTOM ERRORS
// =============================================================================

error ZeroAddress();
error ZeroAmount();
error InvalidLockDuration();
error AlreadySet();
error FaucetAmountNotSet();
error FaucetCooldownActive();
error Unauthorized();
error InvalidInput();
error FactoryNotSet();
error ProjectNotFound();
error InvalidStartTime();
error InvalidProjectDuration();
error ProjectNotActive();
error ProjectNotRefundable();
error AlreadyRefunded();
error InsufficientLiquidityTokensDeposited();
error ProjectNotSuccessfulForLiquidity();
error NoContributionToRefund();
error TokenTransferFailed();
error ExceedsMaxContribution();
error ContributionTooLow();
error InvalidPercentage();
error PriceMismatch();
error CallFailed();
error PlatformFeeRecipientNotSet();
error NotProjectOwner();
error InvalidPair();
error FundingPeriodNotEnded();
error CannotContributeToOwnProject();
error LiquidityAlreadyAdded();
error InsufficientLiquidity();
error InvalidTokenPriceRange();
error WithdrawalLocked();
error InvalidTokenDecimals();
error ZeroTokensCalculated();
error InsufficientTokenBalance();
error TokenAlreadyApproved();
error TokenNotApproved();
error FundingGoalExceeded();
error AMMNotSet();
error InvalidTokenAddress();
error InvalidTokenAllocation();
error TokenApprovalFailed();
error InvalidProjectStatus();
error TokenNotApprovedAsExhibitionContributionToken();
error NoContributionFound();
error NoTokensCurrentlyVested();
error FaucetNotConfigured();
error CalculationOverflow();
error NoUnsoldTokens();
error ZeroTokenPrice();
error TokenPriceTooLow();
error TokenPriceTooHigh(); 
error ContributionTooLarge();
error ContributionTooSmall();
error CalculationResultsInZeroTokens();
error ResultTooLarge();
error ExcessiveLiquidityDeposit();
error FinalCalculationResultsInZeroTokens();
error TokensForSaleMismatch();
error SoftCapBelowMinimum();
error InsufficientTokensForLiquidity();
error LiquidityDeadlineNotReached();
error LiquidityDeadlineExpired();

// =============================================================================
//                                ENUMS
// =============================================================================

enum ProjectStatus {
    Upcoming,        // 0: Project created, awaiting token deposit from project owner
    Active,          // 1: Tokens deposited; accepts contributions once start time is reached
    Successful,      // 2: Funding goal met; tokens claimable, owner has 7 days to add liquidity
    Failed,          // 3: Soft cap not reached by end time; eligible for refunds
    Claimable,       // 4: Token claiming initiated; users can claim, liquidity deadline active
    Refundable,      // 5: Refunds active - triggered by first refund from Failed (normal) or Successful/Claimable after deadline (emergency)
    Completed        // 6: Liquidity added and locked on AMM, funds released to owner; tokens still claimable
}

// =============================================================================
//                                STRUCTS
// =============================================================================

struct Project {
    address projectOwner;             // The address of the project creator
    address projectToken;             // The address of the token being launched (created via ExhibitionFactory)
    address contributionTokenAddress; // The ERC20 token used for contributions (e.g., exUSD, exNEX)
    uint256 fundingGoal;              // Target amount in contribution tokens (equivalent to Hard Cap)
    uint256 softCap;                  // Minimum amount in contribution tokens to raise for project to be successful
    uint256 minContribution;          // Minimum allowed contribution per participant in contribution tokens
    uint256 maxContribution;          // Maximum allowed contribution per participant in contribution tokens
    uint256 tokenPrice;               // tokenPrice The price of 1 project token in contribution tokens (ALWAYS in 18-decimal format, e.g., 0.001 = 1000000000000000).
    uint256 startTime;                // Timestamp when contributions open
    uint256 endTime;                  // Timestamp when contributions close
    uint256 totalRaised;              // Total amount of contribution tokens raised so far
    uint256 totalProjectTokenSupply;  // The total supply of project tokens minted by the factory (owned by project creator)
    string  projectTokenLogoURI;      // TokenLogoURI for UI display
    uint256 amountTokensForSale;      // The subset of totalProjectTokenSupply sent to Exhibition.sol for distribution to contributors
    uint256 liquidityPercentage;      // The percentage of net raised funds committed to initial liquidity by project creator (e.g., 70-100%)
    uint256 lockDuration;             // Duration in seconds for which the initial liquidity will be locked in the AMM
    ProjectStatus status;             // Current status of the project (using enum from IExhibitionPlatform)
    bool liquidityAdded;              // Flag to indicate if initial liquidity has been added to the AMM
    bool vestingEnabled;
    uint256 vestingCliff; // In seconds, relative to project startTime
    uint256 vestingDuration; // In seconds, relative to project startTime
    uint256 vestingInterval; // In seconds
    uint256 vestingInitialRelease; // Percentage (e.g., 2000 for 20.00%)
}

//      Struct to track an individual user's vesting progress for a specific project

struct VestingInfo {
    uint256 totalAmount;    // Total tokens allocated for vesting to this user for this project
    uint256 releasedAmount; // Tokens already claimed by the user from this vesting schedule
    uint256 startTime;      // Actual start time of vesting for this user (after cliff)
    uint256 lastClaimTime;  // Last time the user claimed vested tokens
    uint256 nextClaimTime;  // Timestamp when the next portion of tokens becomes claimable
}

// =============================================================================
//                            INTERFACES
// =============================================================================

/**
 * @title IExhibition
 * @dev Interface for the Exhibition (Main Platform) contract
 */
interface IExhibition {
    // --- Admin/Owner Functions ---
    function setExhibitionFactoryAddress(address _exhibitionFactoryAddress) external;
    function setExhibitionAMMAddress(address _exhibitionAMMAddress) external;
    function setExhTokenAddress(address _exhTokenAddress) external;
    function setExUSDTokenAddress(address _exUSDTokenAddress) external; 
    function setFaucetAmounts(uint256 _exhAmount, uint256 _usdtAmount) external;
    function setFaucetCooldown(uint256 _cooldownSeconds) external;
    function addExhibitionContributionToken(address _tokenAddress) external;
    function removeExhibitionContributionToken(address _tokenAddress) external;
    
    // --- Core Platform Functions ---
    function contribute(uint256 _projectId, uint256 _amount) external;
    function finalizeProject(uint256 _projectId) external;
    function claimTokens(uint256 _projectId) external;
    function requestRefund(uint256 _projectId) external;

    // --- Faucet Functions ---
    function requestFaucetTokens() external;
    function faucetCooldownSeconds() external view returns (uint256);
    function lastFaucetRequest(address user) external view returns (uint256);

    // --- Token Deployment Functions ---
    function deployStandaloneToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        string memory _logoURI
    ) external returns (address newTokenAddress);

    // --- Launchpad Project Functions ---
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
        uint256 _startTime,
        uint256 _endTime,
        uint256 _amountTokensForSale,
        uint256 _liquidityPercentage,
        uint256 _lockDuration,
        bool _vestingEnabled,
        uint256 _vestingCliff,
        uint256 _vestingDuration,
        uint256 _vestingInterval,
        uint256 _vestingInitialRelease
    ) external returns (uint256 projectId, address projectTokenAddress);

    function depositProjectTokens(uint256 _projectId, uint256 _amount) external;
    function depositLiquidityTokens(uint256 _projectId, uint256 _amount) external;
    function finalizeLiquidityAndReleaseFunds(uint256 _projectId) external;
    function addLiquidity(uint256 _projectId) external;
    function withdrawUnsoldTokens(uint256 _projectId) external;
    function isProjectToken(address token) external view returns (bool);
    function projectTokenToProjectId(address token) external view returns (uint256);
    function isEmergencyRefundAvailable(uint256 projectId) external view returns (bool available, uint256 deadline, uint256 timeRemaining);
    function getLiquidityDeadline(uint256 projectId) external view returns (uint256);

    // --- View Functions ---
    function projectCounter() external view returns (uint256);
    function projects(uint256 projectId) external view returns (
        address projectOwner,
        address projectToken,
        address contributionTokenAddress,
        uint256 fundingGoal,
        uint256 softCap,
        uint256 minContribution,
        uint256 maxContribution,
        uint256 tokenPrice,
        uint256 startTime,
        uint256 endTime,
        uint256 totalRaised,
        uint256 totalProjectTokenSupply,
        string memory projectTokenLogoURI,
        uint256 amountTokensForSale,
        uint256 liquidityPercentage,
        uint256 lockDuration,
        ProjectStatus status,
        bool liquidityAdded,
        bool vestingEnabled,
        uint256 vestingCliff,
        uint256 vestingDuration,
        uint256 vestingInterval,
        uint256 vestingInitialRelease
    );
    function getProjectsByOwner(address _owner) external view returns (uint256[] memory);
    function getProjectsByStatus(ProjectStatus _status) external view returns (uint256[] memory);
    function getExNEXAddress() external view returns (address);

    // --- Events ---

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
    event ExhibitionContributionTokenAdded(address indexed tokenAddress);
    event ExhibitionContributionTokenRemoved(address indexed tokenAddress);
    event AmmApprovedForToken(address indexed token, address indexed spender, uint256 amount); // If AMM approval is managed here
    event ExhTokenAddressSet(address indexed tokenAddress);
    event ExhibitionUSDAddressSet(address indexed tokenAddress); 
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
    function getProjectCount() external view returns (uint256);
    function getProjects(uint256 offset, uint256 limit) external view returns (uint256[] memory);
    function getUserContribution(uint256 projectId, address user) external view returns (uint256);
    function getUserVestingInfo(uint256 projectId, address user) external view returns (
        uint256 totalAmount,
        uint256 releasedAmount,
        uint256 startTime,
        uint256 lastClaimTime,
        uint256 nextClaimTime,
        uint256 availableAmount
    );
    function getProjectProgress(uint256 projectId) external view returns (uint256);
    function canAcceptContributions(uint256 projectId) external view returns (bool);
    function getProjectDetails(uint256 projectId) external view returns (
        Project memory project,
        uint256 progressPercentage,
        uint256 timeRemaining,
        bool canContribute,
        uint256 requiredLiquidityTokens,
        uint256 depositedLiquidityTokens
    );
    function getUserProjectSummary(uint256 projectId, address user) external view returns (
        uint256 contributionAmount,
        uint256 tokensOwed,
        uint256 tokensVested,
        uint256 tokensClaimed,
        uint256 tokensAvailable,
        bool userHasRefunded,
        bool canClaim
    );
}

/**
 * @title ITokenCalculation
 * @dev Interface defining all structs, errors, and function signatures
 * @notice All Exhibition project tokens use 18 decimals - projectTokenAddress parameter removed for gas optimization
 */
interface ITokenCalculation {
    // ========================================
    //              STRUCTS
    // ========================================
    
    struct CalculationPreview {
        uint256 tokensReceived;
        uint256 contributionIn18Decimals;
        uint256 effectivePrice;
        uint8 contributionDecimals;
        uint8 projectDecimals;
        uint256 minimumContribution;
        bool isValid;
    }

    struct SystemConstants {
        uint256 minTokenPrice;
        uint256 maxTokenPrice;
        uint256 priceDecimals;
    }

    struct TokenInfo {
        uint8 decimals;
        string symbol;
        string name;
    }

    struct ValidationResult {
        bool isValid;
        uint8 errorCode;
    }

    // ========================================
    //          FUNCTION SIGNATURES
    // ========================================

    /**
     * @dev Calculate tokens due for a contribution
     * @param contributorContribution Amount contributed in contribution token decimals
     * @param tokenPrice Price per project token (always 18 decimals)
     * @param contributionTokenAddress Address of the contribution token (e.g., exUSD)
     * @return Amount of project tokens due (in 18 decimals)
     */
    function calculateTokensDue(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress
    ) external view returns (uint256);

    /**
     * @dev Get detailed calculation preview
     * @param contributorContribution Amount contributed in contribution token decimals
     * @param tokenPrice Price per project token (always 18 decimals)
     * @param contributionTokenAddress Address of the contribution token
     * @return CalculationPreview struct with detailed calculation results
     */
    function getCalculationPreview(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress
    ) external view returns (CalculationPreview memory);

    /**
     * @dev Validate calculation parameters
     * @param contributorContribution Amount contributed in contribution token decimals
     * @param tokenPrice Price per project token (always 18 decimals)
     * @param contributionTokenAddress Address of the contribution token
     * @return ValidationResult struct indicating if calculation is valid
     */
    function validateCalculation(
        uint256 contributorContribution,
        uint256 tokenPrice,
        address contributionTokenAddress
    ) external view returns (ValidationResult memory);

    /**
     * @dev Get minimum contribution required for 1 project token
     * @param tokenPrice Price per project token (always 18 decimals)
     * @param contributionTokenAddress Address of the contribution token
     * @return Minimum contribution amount in contribution token decimals
     */
    function getMinimumContribution(
        uint256 tokenPrice,
        address contributionTokenAddress
    ) external view returns (uint256);

    /**
     * @dev Get token information (decimals, symbol, name)
     * @param tokenAddress Address of the token to query
     * @return TokenInfo struct with token details
     */
    function getTokenInfo(address tokenAddress) external view returns (TokenInfo memory);

    /**
     * @dev Batch calculate tokens for multiple contributions
     * @param contributionAmounts Array of contribution amounts
     * @param tokenPrice Price per project token (always 18 decimals)
     * @param contributionTokenAddress Address of the contribution token
     * @return Array of project token amounts due (in 18 decimals)
     */
    function batchCalculateTokens(
        uint256[] calldata contributionAmounts,
        uint256 tokenPrice,
        address contributionTokenAddress
    ) external view returns (uint256[] memory);

    /**
     * @dev Get system constants (price limits, decimals)
     * @return SystemConstants struct with system configuration
     */
    function getSystemConstants() external view returns (SystemConstants memory);
}


/**
 * @title ISimpleERC20
 * @dev Interface for SimpleERC20 tokens with logo URI and owner functionality
 */
interface ISimpleERC20 is IERC20Metadata {
    function getLogoURI() external view returns (string memory);
    function owner() external view returns (address);
}

/**
 * @title IExhibitionFactory
 * @dev Interface for the ExhibitionFactory contract
 */
interface IExhibitionFactory {
    // --- Admin Functions ---
    function setExhibitionContractAddress(address _exhibitionAddress) external;

    // --- Token Creation ---
    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        string memory _logoURI,
        address _tokenOwner
    ) external returns (address newTokenAddress);

    // --- View Functions ---
    function exhibitionContractAddress() external view returns (address);
    function isTokenCreated(address tokenAddress) external view returns (bool);
    function getTokenCount() external view returns (uint256);
    function getAllCreatedTokens() external view returns (address[] memory);
    function getTokensByCaller(address caller) external view returns (address[] memory);
    function getTokenName(address tokenAddress) external view returns (string memory);
    function getTokenSymbol(address tokenAddress) external view returns (string memory);
    function getTokenLogoURI(address tokenAddress) external view returns (string memory);
    function getTokenOwner(address tokenAddress) external view returns (address);

    // --- Events ---
    event ExhibitionContractAddressSet(address indexed oldAddress, address indexed newAddress);
    event TokenCreated(
        address indexed caller,
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 initialSupply,
        string logoURI,
        address indexed tokenOwner
    );
}

/**
 * @title IExhibitionToken
 * @dev Interface for the Exhibition token
 */
interface IExhibitionToken {
    function mint(address to, uint256 amount) external;
    function transferOwnership(address newOwner) external;
    function owner() external view returns (address);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/**
 * @title IExhibitionUSD
 * @dev Interface for the ExhibitionUSD token
 */
interface IExhibitionUSD {
    function mint(address to, uint256 amount) external;
    function transferOwnership(address newOwner) external;
    function owner() external view returns (address);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function decimals() external view returns (uint8);
}