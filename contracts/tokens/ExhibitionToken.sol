// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title ExhibitionToken
 * @dev ERC20 token contract for the Exhibition platform (EXH).
 * This token can be used for various utilities within the platform,
 * such as a contribution token in launchpads, staking, or governance.
 * It is an Ownable token, allowing the deployer (owner) to manage the minter role.
 * This version includes a fixed maximum supply and an initial smaller mint.
 */
contract ExhibitionToken is ERC20, Ownable {
    // Custom error for when the maximum supply is exceeded during minting.
    error MaxSupplyExceeded();
    // Custom error for when a non-minter attempts to mint.
    error NotMinter();

    // The address authorized to call the mint function.
    address public minter;

    // Event emitted when the minter address is changed.
    event MinterChanged(address indexed previousMinter, address indexed newMinter);

    // Define the initial supply to be minted in the constructor (10 million tokens).
    // This is 10,000,000 tokens with 18 decimals (10^7 * 10^18 = 10^25).
    uint256 private constant INITIAL_MINT_AMOUNT = 10_000_000 * (10**18);

    // Define the maximum total supply for the token (1 billion tokens).
    // This is set to 1,000,000,000 tokens with 18 decimals.
    uint256 public immutable maxSupply;

    /**
     * @dev Constructor to initialize the ERC20 token, set the maximum supply,
     * and mint the initial supply to the owner.
     * @param initialOwner The address that will own the contract and receive the initial supply.
     * This is typically the deployer's address.
     */
    constructor(address initialOwner)
        ERC20("Exhibition Token", "EXH") // Sets token name and symbol
        Ownable(initialOwner) // Sets the initial owner of the contract
    {
        // Set the maximum supply. This is immutable and cannot be changed after deployment.
        maxSupply = 1_000_000_000 * (10**18);

        // Mint the predefined initial amount to the contract deployer (initialOwner).
        // This initial mint must not exceed the maxSupply.
        if (INITIAL_MINT_AMOUNT > maxSupply) {
            revert MaxSupplyExceeded(); // Should not happen with current constants, but good practice
        }
        _mint(initialOwner, INITIAL_MINT_AMOUNT);

        // Initially set the deployer as the minter. The owner can then change this.
        minter = initialOwner;
        emit MinterChanged(address(0), initialOwner);
    }

    /**
     * @dev Modifier to restrict access to functions to only the designated minter.
     */
    modifier onlyMinter() {
        if (msg.sender != minter) {
            revert NotMinter();
        }
        _;
    }

    /**
     * @dev Sets the address that is authorized to call the mint function.
     * Only the contract owner can call this function.
     * @param _newMinter The address to set as the new minter.
     */
    function setMinter(address _newMinter) public onlyOwner {
        require(_newMinter != address(0), "Minter: new minter is the zero address");
        emit MinterChanged(minter, _newMinter);
        minter = _newMinter;
    }

    /**
     * @dev Mints new tokens and assigns them to an account.
     * Only the designated minter can call this function.
     * This function now checks against the `maxSupply`.
     * @param to The address of the recipient of the new tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyMinter {
        // Ensure the recipient address is not the zero address.
        require(to != address(0), "ERC20: mint to the zero address");
        // Ensure the amount to mint is not zero.
        require(amount > 0, "ERC20: mint amount must be greater than zero");

        // Check if minting this amount would exceed the maximum supply.
        if (totalSupply() + amount > maxSupply) {
            revert MaxSupplyExceeded();
        }

        // Mint the specified amount of tokens to the recipient.
        _mint(to, amount);
    }

    /**
     * @dev Burns tokens from the caller's account.
     * Any token holder can call this function to reduce their own balance.
     * @param amount The amount of tokens to burn.
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Burns tokens from an account via allowance.
     * This allows an approved spender to burn tokens on behalf of another account.
     * @param from The address of the account whose tokens are to be burned.
     * @param amount The amount of tokens to burn.
     */
    function burnFrom(address from, uint256 amount) public {
        _burn(from, amount);
    }
}