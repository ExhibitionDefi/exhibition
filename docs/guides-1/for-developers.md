---
description: Onchain Tokenomist is deployed and accessible via its contract interface.
---

# For Developers

{% hint style="info" %}
#### This guide covers everything needed to integrate Onchain Tokenomist into your application — from creating vaults and managing proposals to minting passes and claiming tokens.
{% endhint %}

#### Setup

typescript

```typescript
import { ethers } from 'ethers';

const tokenomist = await ethers.getContractAt('OnchainTokenomist', TOKENOMIST_ADDRESS);
```

***

#### Creating a Vault

**ERC-20 Vault**

typescript

```typescript
const registrationFee = await tokenomist.registrationFee();

// Approve token deposit
await token.approve(tokenomist.address, depositAmount);

const tx = await tokenomist.createVault(
    token.address,         // ERC-20 contract address
    depositAmount,         // total tokens to deposit
    admin1.address,        // admin1 — zero address for creator mode
    admin2.address,        // admin2 — zero address for creator mode
    executor.address,      // executor — zero address if not used
    startBlock,            // token generation event block
    tierConfigs,           // tier configuration array
    vestingConfigs,        // vesting configuration array per category
    { value: registrationFee } // exact registration fee in native token
);

const receipt = await tx.wait();
// VaultCreated event contains vaultId
```

**Native Token Vault**

typescript

```typescript
const registrationFee = await tokenomist.registrationFee();
const depositAmount = ethers.parseEther('100000');
const totalMsgValue = registrationFee + depositAmount;

const tx = await tokenomist.createVault(
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // native token sentinel
    depositAmount,
    admin1.address,
    admin2.address,
    executor.address,
    startBlock,
    tierConfigs,
    vestingConfigs,
    { value: totalMsgValue } // registration fee + deposit in one transaction
);
```

**Tier Configuration**

typescript

```typescript
const tierConfigs = [
    {
        category: ethers.encodeBytes32String('Team'),
        tier: ethers.encodeBytes32String('Diamond'),
        allocationPerPass: ethers.parseEther('40000'),
        maxSupply: 1
    },
    {
        category: ethers.encodeBytes32String('Team'),
        tier: ethers.encodeBytes32String('Gold'),
        allocationPerPass: ethers.parseEther('5000'),
        maxSupply: 2
    },
    {
        category: ethers.encodeBytes32String('Community'),
        tier: ethers.encodeBytes32String('Builder'),
        allocationPerPass: ethers.parseEther('5000'),
        maxSupply: 500
    }
];
```

**Vesting Configuration**

typescript

```typescript
const vestingConfigs = [
    {
        category: ethers.encodeBytes32String('Team'),
        enabled: true,
        initialRelease: 0,        // 0% at start block
        cliff: 16200000,            // ~90 days in blocks
        duration: 64800000,        // ~360 days in blocks
        interval: 5400000           // ~30 days in blocks
    },
    {
        category: ethers.encodeBytes32String('Community'),
        enabled: false,           // 100% liquid at start block
        initialRelease: 0,
        cliff: 0,
        duration: 0,
        interval: 0
    }
];
```

***

#### Querying Vault Data

solidity

```solidity
// Full vault summary — allocations, claimed amounts, status
function getVaultSummary(uint256 vaultId) external view returns (VaultSummary memory);

// Multiple vaults in one call
function getVaultSummaries(uint256 startId, uint256 count) external view returns (VaultSummary[] memory);

// All vaults created by a specific address
function getVaultSummariesByCreator(address creator) external view returns (VaultSummary[] memory);

// Per-category allocation breakdown
function getVaultCategoryAllocations(uint256 vaultId) external view returns (CategoryAllocation[] memory);

// Tier details — allocation per pass, max supply, minted count
function getTierDetails(uint256 vaultId, bytes32 category, bytes32 tier) external view returns (TierDetails memory);

// All tier details for a category
function getCategoryTierDetails(uint256 vaultId, bytes32 category) external view returns (TierDetails[] memory);

// Vesting schedule for a category
function getVestingSchedule(uint256 vaultId, bytes32 category) external view returns (VestingSchedule memory);

// All categories in a vault
function getVaultCategories(uint256 vaultId) external view returns (bytes32[] memory);

// All tiers in a category
function getCategoryTiers(uint256 vaultId, bytes32 category) external view returns (bytes32[] memory);

// Platform stats
function getPlatformStats() external view returns (PlatformStats memory);
```

***

#### Minting Passes

**Creator Mode — Direct Mint**

typescript

```typescript
await tokenomist.mintDirect(
    vaultId,
    ethers.encodeBytes32String('Community'),
    ethers.encodeBytes32String('Builder'),
    [recipient1, recipient2, recipient3]
);
```

**Dual-Admin Mode — Proposal Flow**

**Step 1 — Submit proposal:**

typescript

```typescript
const tierBatches = [
    {
        tier: ethers.encodeBytes32String('Diamond'),
        merkleRoot: diamondMerkleRoot,
        supplyCount: 1
    },
    {
        tier: ethers.encodeBytes32String('Gold'),
        merkleRoot: goldMerkleRoot,
        supplyCount: 2
    }
];

const tx = await tokenomist.proposeMintCategory(
    vaultId,
    ethers.encodeBytes32String('Team'),
    tierBatches
);

const receipt = await tx.wait();
// ProposalCreated event contains proposalId
```

**Step 2 — Admin approval:**

typescript

```typescript
// Both admins must approve independently
await tokenomist.connect(admin1).approveMintProposal(proposalId);
await tokenomist.connect(admin2).approveMintProposal(proposalId);
```

**Step 3 — Mint passes:**

typescript

```typescript
await tokenomist.mintPasses(
    proposalId,
    ethers.encodeBytes32String('Diamond'),
    [recipient1],
    [merkleProof1]
);
```

**Rejecting a proposal:**

typescript

```typescript
// Either admin can permanently reject
await tokenomist.connect(admin1).rejectMintProposal(proposalId);
```

***

#### Querying Pass Data

solidity

```solidity
// All token IDs held by an address
function getOwnerTokenIds(address owner) external view returns (uint256[] memory);

// Full pass info for multiple token IDs
function getUserPasses(uint256[] calldata tokenIds) external view returns (UserPassInfo[] memory);
```

typescript

```typescript
const tokenIds = await tokenomist.getOwnerTokenIds(userAddress);
const passes = await tokenomist.getUserPasses(tokenIds);

for (const pass of passes) {
    console.log('Vault:', pass.vaultId);
    console.log('Category:', ethers.decodeBytes32String(pass.category));
    console.log('Tier:', ethers.decodeBytes32String(pass.tier));
    console.log('Total allocation:', pass.allocationPerPass);
    console.log('Claimed:', pass.claimed);
    console.log('Remaining:', pass.remaining);
    console.log('Claimable now:', pass.claimableNow);
    console.log('Next unlock block:', pass.nextUnlockBlock);
}
```

***

#### Claiming

typescript

```typescript
// Claim from one or multiple passes in a single transaction
const tokenIds = await tokenomist.getOwnerTokenIds(userAddress);
await tokenomist.claim(tokenIds);
```

The contract calculates the vested amount at the current block, subtracts previously claimed amounts, and transfers the difference. Works identically for ERC-20 and native token vaults. Once fully claimed, the pass burns automatically.

***

#### Querying Proposals

solidity

```solidity
// All pending proposals for an admin
function getAdminPendingProposals(address admin) external view returns (ProposalInfo[] memory);

// All proposals an address is involved in
function getInvolvedProposals(address account) external view returns (ProposalInfo[] memory);

// Tier details for a specific proposal
function getProposalTiers(uint256 proposalId) external view returns (
    bytes32[] memory tiers,
    bytes32[] memory merkleRoots,
    uint256[] memory remainingSupplies,
    uint256[] memory supplyCounts,
    uint256[] memory mintedCounts,
    bool admin1Approved,
    bool admin2Approved,
    bool rejected,
    bool expired,
    bool executed
);
```

***

#### Fee Queries

typescript

```typescript
// Registration fee — same for all vault types
const fee = await tokenomist.registrationFee();

// ERC-20 vault cost — msg.value required
const erc20Cost = await tokenomist.getERC20VaultCost();

// Native token vault cost — msg.value required (fee + deposit)
const nativeCost = await tokenomist.getNativeVaultCost(depositAmount);
```

***

#### Discovery Helpers

solidity

```solidity
function getNextVaultId() external view returns (uint256);
function getNextProposalId() external view returns (uint256);
```
