import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface ContributorData {
    rank: number;
    address: string;
    amount: string;
    amountRaw: bigint;
    percentage: string;
    hasContributed: boolean;
}

async function main() {
    console.log("Starting Enhanced Contributor Count Query Script...");

    // Get deployer/admin signer
    const [deployer] = await ethers.getSigners();
    console.log(`Querying with account: ${deployer.address}`);

    // --- Load deployed addresses ---
    const filePath = path.join(__dirname, 'deployed_full_platform_addresses_local.json');
    if (!fs.existsSync(filePath)) {
        console.error(`Error: ${filePath} not found. Please run deploy.ts first.`);
        process.exit(1);
    }
    const deployedAddresses = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const exhibitionAddress = deployedAddresses.Exhibition as string;

    console.log(`\nLoaded Exhibition Contract: ${exhibitionAddress}`);

    // Get Exhibition contract instance
    const exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);

    // Prompt for project ID (you can hardcode or pass as argument)
    const projectId = process.argv[2] ? BigInt(process.argv[2]) : 1n; // Default to project ID 1
    
    console.log(`\n--- Querying Contributors for Project ID: ${projectId} ---`);

    try {
        // Get project details first
        const project = await exhibition.projects(projectId);
        
        // Based on the Exhibition contract Project struct:
        // Index 0: projectOwner
        // Index 1: projectToken  
        // Index 2: contributionToken ✅
        const contributionTokenAddress = project[2] as string;
        
        if (!contributionTokenAddress || !ethers.isAddress(contributionTokenAddress)) {
            console.error(`Invalid contribution token address: ${contributionTokenAddress}`);
            process.exit(1);
        }
        
        const contributionToken = await ethers.getContractAt("IERC20Metadata", contributionTokenAddress);
        const tokenDecimals = Number(await contributionToken.decimals());
        const tokenSymbol = await contributionToken.symbol();

        // Get contributor count
        const contributorCount = await exhibition.getProjectContributorCount(projectId);
        console.log(`Total Contributors: ${contributorCount}`);

        if (contributorCount === 0n) {
            console.log("No contributors found for this project.");
            return;
        }

        // Get all contributors and their data
        console.log("\n--- Fetching Contributor Data ---");
        const contributorsData: ContributorData[] = [];
        
        for (let i = 0; i < contributorCount; i++) {
            const contributorAddress = await exhibition.projectContributors(projectId, i);
            const contributionAmount = await exhibition.contributions(projectId, contributorAddress);
            const hasContributed = await exhibition.hasUserContributed(projectId, contributorAddress);
            
            const percentage = project.totalRaised > 0n 
                ? (Number(contributionAmount * 10000n / project.totalRaised) / 100).toFixed(2)
                : "0.00";

            contributorsData.push({
                rank: i + 1,
                address: contributorAddress,
                amount: ethers.formatUnits(contributionAmount, tokenDecimals),
                amountRaw: contributionAmount,
                percentage: percentage,
                hasContributed: hasContributed
            });
        }

        // Sort by contribution amount (descending)
        contributorsData.sort((a, b) => {
            if (a.amountRaw > b.amountRaw) return -1;
            if (a.amountRaw < b.amountRaw) return 1;
            return 0;
        });

        // Update ranks after sorting
        contributorsData.forEach((data, index) => {
            data.rank = index + 1;
        });

        // Display formatted table
        console.log("\n╔════════════════════════════════════════════════════════════════════════════════╗");
        console.log("║                          CONTRIBUTOR LEADERBOARD                               ║");
        console.log("╚════════════════════════════════════════════════════════════════════════════════╝");
        console.log("");
        console.log("┌──────┬──────────────────────────────────────────────┬──────────────────┬──────────┐");
        console.log("│ Rank │ Address                                      │ Amount           │ Share %  │");
        console.log("├──────┼──────────────────────────────────────────────┼──────────────────┼──────────┤");

        contributorsData.forEach(data => {
            const addressShort = `${data.address.substring(0, 8)}...${data.address.substring(data.address.length - 6)}`;
            const rankStr = data.rank.toString().padStart(4, ' ');
            const addressStr = addressShort.padEnd(44, ' ');
            const amountStr = `${parseFloat(data.amount).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${tokenSymbol}`.padEnd(16, ' ');
            const percentStr = `${data.percentage}%`.padStart(8, ' ');
            
            console.log(`│ ${rankStr} │ ${addressStr} │ ${amountStr} │ ${percentStr} │`);
        });

        console.log("└──────┴──────────────────────────────────────────────┴──────────────────┴──────────┘");

        // Detailed contributor information
        console.log("\n╔════════════════════════════════════════════════════════════════════════════════╗");
        console.log("║                        DETAILED CONTRIBUTOR INFO                               ║");
        console.log("╚════════════════════════════════════════════════════════════════════════════════╝");
        
        for (const data of contributorsData) {
            console.log(`\n┌─ Rank #${data.rank} ─────────────────────────────────────────────────────────────────────┐`);
            console.log(`│ Address:         ${data.address}`);
            console.log(`│ Contribution:    ${parseFloat(data.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${tokenSymbol}`);
            console.log(`│ Share:           ${data.percentage}% of total raised`);
            console.log(`│ Status:          ${data.hasContributed ? '✅ Verified Contributor' : '❌ Not Verified'}`);
            console.log(`└────────────────────────────────────────────────────────────────────────────────┘`);
        }

        // Project summary
        console.log("\n╔════════════════════════════════════════════════════════════════════════════════╗");
        console.log("║                            PROJECT SUMMARY                                     ║");
        console.log("╚════════════════════════════════════════════════════════════════════════════════╝");
        console.log(`\n  Project ID:        ${projectId}`);
        console.log(`  Token:             ${tokenSymbol}`);
        console.log(`  Total Raised:      ${parseFloat(ethers.formatUnits(project.totalRaised, tokenDecimals)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tokenSymbol}`);
        console.log(`  Soft Cap:          ${parseFloat(ethers.formatUnits(project.softCap, tokenDecimals)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tokenSymbol}`);
        console.log(`  Hard Cap:          ${parseFloat(ethers.formatUnits(project.fundingGoal, tokenDecimals)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tokenSymbol}`);
        console.log(`  Progress:          ${((Number(project.totalRaised) / Number(project.fundingGoal)) * 100).toFixed(2)}% of Hard Cap`);
        console.log(`  Contributors:      ${contributorCount}`);
        console.log(`  Project Status:    ${getStatusName(Number(project.status))}`);

        // Statistics
        console.log("\n╔════════════════════════════════════════════════════════════════════════════════╗");
        console.log("║                          CONTRIBUTION STATISTICS                               ║");
        console.log("╚════════════════════════════════════════════════════════════════════════════════╝");
        
        const amounts = contributorsData.map(d => Number(d.amount));
        const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0);
        const avgContribution = totalAmount / amounts.length;
        const maxContribution = Math.max(...amounts);
        const minContribution = Math.min(...amounts);
        
        console.log(`\n  Average Contribution:     ${avgContribution.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tokenSymbol}`);
        console.log(`  Largest Contribution:     ${maxContribution.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tokenSymbol}`);
        console.log(`  Smallest Contribution:    ${minContribution.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tokenSymbol}`);
        console.log(`  Median Contribution:      ${getMedian(amounts).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tokenSymbol}`);

        // Export to CSV
        const csvFilePath = path.join(__dirname, `contributors_project_${projectId}.csv`);
        const csvHeader = "Rank,Address,Amount,Percentage,HasContributed\n";
        const csvRows = contributorsData.map(data => 
            `${data.rank},${data.address},${data.amount},${data.percentage},${data.hasContributed}`
        ).join("\n");
        
        fs.writeFileSync(csvFilePath, csvHeader + csvRows);
        console.log(`\n📊 CSV exported to: ${csvFilePath}`);

        // Export to JSON (convert BigInt to string for serialization)
        const jsonFilePath = path.join(__dirname, `contributors_project_${projectId}.json`);
        const jsonData = {
            projectId: projectId.toString(),
            tokenSymbol: tokenSymbol,
            tokenDecimals: tokenDecimals,
            totalRaised: ethers.formatUnits(project.totalRaised, tokenDecimals),
            totalRaisedRaw: project.totalRaised.toString(),
            softCap: ethers.formatUnits(project.softCap, tokenDecimals),
            hardCap: ethers.formatUnits(project.fundingGoal, tokenDecimals),
            contributorCount: contributorCount.toString(),
            contributors: contributorsData.map(data => ({
                rank: data.rank,
                address: data.address,
                amount: data.amount,
                amountRaw: data.amountRaw.toString(), // Convert BigInt to string
                percentage: data.percentage,
                hasContributed: data.hasContributed
            })),
            statistics: {
                average: avgContribution,
                max: maxContribution,
                min: minContribution,
                median: getMedian(amounts)
            },
            projectStatus: getStatusName(Number(project.status)),
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));
        console.log(`📄 JSON exported to: ${jsonFilePath}`);

    } catch (error: any) {
        console.error(`\n❌ Error querying contributors: ${error.message}`);
        process.exit(1);
    }

    console.log("\n✅ Contributor count query completed successfully!\n");
}

function getStatusName(status: number): string {
    const statusNames: Record<number, string> = {
        0: 'Upcoming',
        1: 'Active',
        2: 'Successful',
        3: 'Failed',
        4: 'Claimable',
        5: 'Refundable',
        6: 'Completed'
    };
    return statusNames[status] || `Unknown (${status})`;
}

function getMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2 
        : sorted[mid];
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});