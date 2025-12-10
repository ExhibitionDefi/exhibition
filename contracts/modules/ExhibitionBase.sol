// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libraries/IExhibitionPlatform.sol";
import "../libraries/ExLibrary.sol";
import "../libraries/IExhibitionAMM.sol";

/**
 * @title ExhibitionBase
 * @dev Abstract base contract containing core state variables, constants, and events
 */
abstract contract ExhibitionBase is Ownable, ReentrancyGuard, ITokenCalculation {
    using SafeERC20 for IERC20;
    using TokenCalculationLib for *;

    // CONSTANTS
    uint256 public immutable MIN_START_DELAY = 15 minutes;
    uint256 public immutable MAX_PROJECT_DURATION = 21 days;
    uint256 public constant MIN_LOCK_DURATION = 14 days;
    uint256 public constant MIN_TOKEN_PRICE = 1e12;
    uint256 public constant MAX_TOKEN_PRICE = 1e24;
    uint256 public constant PRICE_DECIMALS = 18;
    uint256 public constant WITHDRAWAL_DELAY = 1 days;
    uint256 public constant LIQUIDITY_FINALIZATION_DEADLINE = 7 days;

    // STATE VARIABLES
    address public exhibitionFactory;
    address public exhibitionAMM;
    address public exhTokenAddress;
    address public exUSDTokenAddress;
    uint256 public platformFeePercentage;
    address public platformFeeRecipient;
    uint256 public faucetAmountEXH;
    uint256 public faucetAmountexUSD;
    uint256 public faucetCooldownSeconds;
    mapping(address => uint256) internal lastFaucetRequestTime;
    address[] public ExhibitionContributionTokens;
    mapping(address => bool) public isExhibitionContributionToken;
    uint256 internal projectIdCounter;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    mapping(uint256 => mapping(address => VestingInfo)) public vestingInfo;
    mapping(uint256 => mapping(address => bool)) public hasRefunded;
    mapping(uint256 => uint256) public projectLiquidityTokenDeposits;
    // Contributor tracking
    mapping(uint256 => address[]) public projectContributors;  // projectId => array of contributor addresses
    mapping(uint256 => mapping(address => bool)) public hasContributed;  // projectId => user => has contributed
    mapping(uint256 => uint256) public contributorCount;
    mapping(uint256 => uint256) public successTimestamp;
    // Track all project tokens created through Exhibition
    mapping(address => bool) public isProjectToken;
    mapping(address => uint256) public projectTokenToProjectId;

    // EVENTS
    event ExhibitionFactoryAddressSet(address indexed oldAddress, address indexed newAddress);
    event ExhibitionAMMAddressSet(address indexed oldAddress, address indexed newAddress);
    event ExhTokenAddressSet(address indexed tokenAddress);
    event ExhibitionUSDAddressSet(address indexed tokenAddress);
    event PlatformFeePercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event PlatformFeeRecipientUpdated(address oldRecipient, address newRecipient);
    event ExhibitionContributionTokenAdded(address indexed tokenAddress);
    event ExhibitionContributionTokenRemoved(address indexed tokenAddress);
    event AmmApprovedForToken(address indexed token, address indexed spender, uint256 amount);
    event FaucetRequested(address indexed user, uint256 exhAmount, uint256 exusdAmount);
    event FaucetMinted(address indexed user, address indexed token, uint256 amount);
    event StandaloneTokenDeployed(address indexed deployer, address indexed tokenAddress, string name, string symbol, uint256 initialSupply, string logoURI);
    event ProjectCreated(uint256 indexed projectId, address indexed projectOwner, address projectToken, address contributionTokenAddress, uint256 fundingGoal, uint256 softCap, uint256 totalProjectTokenSupply, string projectTokenLogoURI, uint256 amountTokensForSale, uint256 liquidityPercentage, uint256 lockDuration, uint256 startTime, uint256 endTime);
    event TokensDepositedForProject(uint256 indexed projectId, address indexed tokenAddress, uint256 amount, ProjectStatus Status);
    event ProjectStatusUpdated(uint256 indexed projectId, ProjectStatus newStatus);
    event ProjectFinalized(uint256 indexed projectId, ProjectStatus newStatus, uint256 totalRaised);
    event ContributionMade(uint256 indexed projectId, address indexed contributor, uint256 amount, address contributionTokenAddress, uint256 totalRaised);
    event HardCapReached(uint256 indexed projectId, uint256 totalRaised, uint256 hardCap);
    event SoftCapReach(uint256 indexed projectId, uint256 totalRaised, uint256 softCap);
    event SoftCapNotReach(uint256 indexed projectId, uint256 totalRaised);
    event TokensClaimed(uint256 indexed projectId, address indexed contributor, uint256 amountClaimed, uint256 totalClaimedForContributor);
    event VestingClaimed(uint256 indexed projectId, address indexed user, uint256 amount);
    event RefundIssued(uint256 indexed projectId, address indexed participant, uint256 refundedAmount);
    event LiquidityTokensDeposited(uint256 indexed projectId, address indexed depositor, uint256 amount);
    event LiquidityDeadlinePassed(uint256 indexed projectId, uint256 timestamp);
    event LiquidityAdded(uint256 indexed projectId, address indexed projectOwner, uint256 projectTokensAdded, uint256 contributionTokensAdded, uint256 liquidityMinted);
    event PlatformFeeCollected(uint256 indexed projectId, address indexed tokenAddress, uint256 amount, address indexed recipient);
    event FundsReleasedToProjectOwner(uint256 indexed projectId, address indexed projectOwner, uint256 amountReleased, ProjectStatus finalStatus);
    event UnsoldTokensWithdrawn(uint256 indexed projectId, address indexed projectOwner, uint256 amount);
    event FirstTimeContributor(uint256 indexed projectId, address indexed contributor, uint256 contributorNumber);

    constructor() Ownable(msg.sender) {}

    // INTERNAL HELPERS
    function _transferTokens(address _tokenAddress, address _from, address _to, uint256 _amount) internal {
        if (_amount == 0) return;
        if (ExLibrary.isZeroAddress(_to)) revert InvalidInput();
        if (_from == address(this)) {
            IERC20(_tokenAddress).safeTransfer(_to, _amount);
        } else {
            IERC20(_tokenAddress).safeTransferFrom(_from, _to, _amount);
        }
    }

    function _approveTokens(address _tokenAddress, address _spender, uint256 _amount) internal {
        if (_tokenAddress == address(0)) revert InvalidInput();
        IERC20(_tokenAddress).forceApprove(_spender, _amount);
    }

    function _checkExhibitionContributionToken(address _tokenAddress) internal view {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        if (!isExhibitionContributionToken[_tokenAddress]) revert TokenNotApprovedAsExhibitionContributionToken();
    }

    receive() external payable {
        revert Unauthorized();
    }
}