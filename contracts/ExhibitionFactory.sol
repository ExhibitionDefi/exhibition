// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimpleERC20
 * @dev A simple ERC20 token contract that can be deployed by the factory.
 * The initial supply is minted to a specified owner, and it stores a logo URI.
 * This contract is now Ownable, with the initial supply recipient as its owner.
 * Decimals are explicitly set to 18.
 */
contract SimpleERC20 is ERC20, Ownable {
    string private _logoURI; // Changed to private, will use a getter function

    // Define the number of decimals for this token. Standard ERC20 uses 18 decimals.
    uint8 private constant _DECIMALS = 18; // MODIFIED: Explicitly set decimals to 18

    /**
     * @dev Constructor to initialize a new ERC20 token, mint initial supply to an owner, set logo URI,
     * and set the owner of this token contract.
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     * @param initialSupply_ The total initial supply of the token.
     * @param owner_ The address to which the initial supply will be minted AND who will be the owner of this contract.
     * @param logoURI_ The URL for the token's logo.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        address owner_,
        string memory logoURI_
    )
        ERC20(name_, symbol_)
        Ownable(owner_)
    {
        _mint(owner_, initialSupply_); // Mints the initial supply to the specified owner_
        _logoURI = logoURI_; // Store the logo URI on-chain
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For SimpleERC20, this is 18.
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS; // MODIFIED: Return the explicit _DECIMALS constant
    }

    /**
     * @dev Returns the logo URI of the token.
     */
    function getLogoURI() public view returns (string memory) {
        return _logoURI;
    }
}

/**
 * @title ExhibitionFactory
 * @dev A factory contract responsible for deploying new ERC20 tokens.
 * This contract will be deployed first and its address will be provided to Exhibition.
 * Its `createToken` function is restricted to the owner (Exhibition).
 */
contract ExhibitionFactory is Ownable {
    // --- Custom Errors ---
    error UnauthorizedCaller(); // New error for createToken restriction
    error ZeroAddress(); // For input validation (e.g., setting exhibitionContractAddress to zero)

    // --- State Variables for Factory Control ---
    // The address of the main Exhibition contract that is authorized to call createToken.
    address public exhibitionContractAddress;

    // --- State Variables for Tracking Created Tokens ---
    uint256 public tokenCount; // Total count of tokens created by this factory.
    mapping(address => bool) public isTokenCreated; // Mapping to check if a given token address was created by this factory.
    address[] public allCreatedTokens; // Array to store all token addresses created by this factory.
    // Mapping from caller of createToken (e.g., Exhibition) to a list of tokens it created.
    mapping(address => address[]) public callerCreatedTokens; // Renamed from creatorCreatedTokens for clarity


    // --- Events ---
    /**
     * @dev Emitted when the authorized Exhibition contract address is set or updated.
     * @param oldAddress The previous authorized Exhibition contract address.
     * @param newAddress The new authorized Exhibition contract address.
     */
    event ExhibitionContractAddressSet(address indexed oldAddress, address indexed newAddress);

    /**
     * @dev Emitted when a new token is created by the factory.
     * @param caller The address that called the createToken function (e.g., Exhibition).
     * @param tokenAddress The address of the newly deployed ERC20 token.
     * @param name The name of the new token.
     * @param symbol The symbol of the new token.
     * @param initialSupply The initial total supply of the new token.
     * @param logoURI The URL for the token's logo.
     * @param tokenOwner The address to which the initial supply was minted AND who is the owner of the new token contract.
     */
    event TokenCreated(
        address indexed caller,
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 initialSupply,
        string logoURI,
        address indexed tokenOwner
    );

    // --- Constructor ---
    constructor() Ownable(msg.sender) {} // Deployer of ExhibitionFactory becomes its owner

    // --- Admin Functions (Owner-only) ---

    /**
     * @dev Sets the address of the main Exhibition contract that is authorized to call `createToken`.
     * Only the owner of this factory can call this.
     * This address can be updated by the owner.
     * @param _exhibitionAddress The address of the Exhibition contract.
     */
    function setExhibitionContractAddress(address _exhibitionAddress) public onlyOwner {
        if (_exhibitionAddress == address(0)) revert ZeroAddress();
        emit ExhibitionContractAddressSet(exhibitionContractAddress, _exhibitionAddress);
        exhibitionContractAddress = _exhibitionAddress;
    }

    // --- Functions ---

    /**
     * @dev Deploys a new ERC20 token contract and mints its initial supply to a specified owner.
     * This function is now restricted to be callable ONLY by the `exhibitionContractAddress`.
     * @param _name The name of the token.
     * @param _symbol The symbol of the token.
     * @param _initialSupply The total initial supply of the token to be minted.
     * @param _logoURI The URL for the token's logo.
     * @param _tokenOwner The address to which the initial supply will be minted AND who will be the owner of the new token contract.
     * @return newTokenAddress The address of the newly deployed token.
     */
    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        string memory _logoURI,
        address _tokenOwner
    ) public returns (address newTokenAddress) {
        // Only the authorized Exhibition contract can call this function.
        if (msg.sender != exhibitionContractAddress) revert UnauthorizedCaller();
        // Ensure the Exhibition contract address has been set.
        if (exhibitionContractAddress == address(0)) revert ZeroAddress(); // More specific error could be FactoryNotConfigured()

        // Deploy the SimpleERC20 contract, passing the logoURI and _tokenOwner to its constructor
        SimpleERC20 newToken = new SimpleERC20(_name, _symbol, _initialSupply, _tokenOwner, _logoURI);
        newTokenAddress = address(newToken);

        // Update tracking state variables
        tokenCount++;
        isTokenCreated[newTokenAddress] = true;
        allCreatedTokens.push(newTokenAddress);
        callerCreatedTokens[msg.sender].push(newTokenAddress); // msg.sender is Exhibition

        // Emit an event for off-chain services to track the new token
        emit TokenCreated(msg.sender, newTokenAddress, _name, _symbol, _initialSupply, _logoURI, _tokenOwner);
    }

    // --- Read/Get Functions for Factory-Level Tracking ---

    /**
     * @dev Returns the total number of tokens created by this factory.
     */
    function getTokenCount() public view returns (uint256) {
        return tokenCount;
    }

    /**
     * @dev Returns an array of all token addresses created by this factory.
     */
    function getAllCreatedTokens() public view returns (address[] memory) {
        return allCreatedTokens;
    }

    /**
     * @dev Returns an array of token addresses created by a specific caller (e.g., Exhibition).
     * @param caller The address of the caller (e.g., Exhibition contract address).
     */
    function getTokensByCaller(address caller) public view returns (address[] memory) {
        return callerCreatedTokens[caller];
    }

    /**
     * @dev Returns the name of a token deployed by this factory.
     * Requires the tokenAddress to be a valid SimpleERC20 contract.
     * @param tokenAddress The address of the deployed token.
     */
    function getTokenName(address tokenAddress) public view returns (string memory) {
        return SimpleERC20(tokenAddress).name();
    }

    /**
     * @dev Returns the symbol of a token deployed by this factory.
     * Requires the tokenAddress to be a valid SimpleERC20 contract.
     * @param tokenAddress The address of the deployed token.
     */
    function getTokenSymbol(address tokenAddress) public view returns (string memory) {
        return SimpleERC20(tokenAddress).symbol();
    }

    /**
     * @dev Returns the logo URI of a token deployed by this factory.
     * Requires the tokenAddress to be a valid SimpleERC20 contract.
     * @param tokenAddress The address of the deployed token.
     */
    function getTokenLogoURI(address tokenAddress) public view returns (string memory) {
        return SimpleERC20(tokenAddress).getLogoURI();
    }

    /**
     * @dev Returns the owner of a token deployed by this factory.
     * Requires the tokenAddress to be a valid SimpleERC20 contract.
     * @param tokenAddress The address of the deployed token.
     */
    function getTokenOwner(address tokenAddress) public view returns (address) {
        return SimpleERC20(tokenAddress).owner(); // Calls the owner() function on the SimpleERC20 contract
    }
}
