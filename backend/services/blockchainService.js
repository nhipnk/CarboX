const { ethers } = require('ethers');
const marketplaceABI = require('../abis/CarbonMarketplace.json');

// ============================================================
// blockchainService.js
// Dùng để backend CHỦ ĐỘNG GỌI HÀM lên smart contract
// (cần ADMIN_PRIVATE_KEY trong .env để ký giao dịch)
// ============================================================

let provider;
let adminWallet;
let marketplaceContract;
let validatorWallet;
let validatorMarketplaceContract;

const getContracts = () => {
    if (!provider) {
        provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    }
    if (!adminWallet) {
        if (!process.env.ADMIN_PRIVATE_KEY) {
            throw new Error('Thiếu ADMIN_PRIVATE_KEY trong .env — cần để backend ký giao dịch lên contract');
        }
        adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
    }
    if (!marketplaceContract) {
        marketplaceContract = new ethers.Contract(
            process.env.MARKETPLACE_CONTRACT_ADDRESS,
            marketplaceABI.abi,
            adminWallet // dùng signer để có thể write
        );
    }
    return { marketplaceContract, adminWallet };
};

const getValidatorContracts = () => {
    if (!provider) {
        provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    }
    if (!validatorWallet) {
        const validatorKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY;
        if (!validatorKey) {
            throw new Error('Thiếu VALIDATOR_PRIVATE_KEY hoặc ADMIN_PRIVATE_KEY trong .env — cần để backend ký vote.');
        }
        validatorWallet = new ethers.Wallet(validatorKey, provider);
    }
    if (!validatorMarketplaceContract) {
        validatorMarketplaceContract = new ethers.Contract(
            process.env.MARKETPLACE_CONTRACT_ADDRESS,
            marketplaceABI.abi,
            validatorWallet
        );
    }
    return { marketplaceContract: validatorMarketplaceContract, validatorWallet };
};

// ============================================================
// approveAndMintOnChain
// Được gọi từ projectRoutes khi Admin duyệt dự án
// Tương đương: marketplaceContract.approveAndMint(projectId, approvedCO2Kg, tokenURI)
//
// Params:
//   - onChainProjectId: projectId trên blockchain (số nguyên)
//   - approvedCO2Kg   : lượng CO2 admin xác nhận (số nguyên, đơn vị kg)
//   - tokenURI        : link IPFS metadata của token (vd: "ipfs://Qm...")
// ============================================================
const approveAndMintOnChain = async (onChainProjectId, approvedCO2Kg, tokenURI) => {
    const { marketplaceContract } = getContracts();

    const tx = await marketplaceContract.approveAndMint(
        onChainProjectId,
        approvedCO2Kg,
        tokenURI
    );

    // Chờ transaction được confirm 1 block
    const receipt = await tx.wait(1);

    return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
    };
};

// ============================================================
// addValidatorOnChain
// Thêm validator mới vào contract (chỉ owner gọi được)
// ============================================================
const addValidatorOnChain = async (validatorAddress) => {
    const { marketplaceContract } = getContracts();
    const tx = await marketplaceContract.addValidator(validatorAddress);
    const receipt = await tx.wait(1);
    return { txHash: receipt.hash };
};

// ============================================================
// removeValidatorOnChain
// ============================================================
const removeValidatorOnChain = async (validatorAddress) => {
    const { marketplaceContract } = getContracts();
    const tx = await marketplaceContract.removeValidator(validatorAddress);
    const receipt = await tx.wait(1);
    return { txHash: receipt.hash };
};

// ============================================================
// getProjectOnChain
// Đọc thông tin project từ blockchain (read-only, không tốn gas)
// ============================================================
const getProjectOnChain = async (onChainProjectId) => {
    const { marketplaceContract } = getContracts();
    const project = await marketplaceContract.projects(onChainProjectId);
    return {
        projectId:     Number(project.projectId),
        owner:         project.owner,
        projectURI:    project.projectURI,
        proposedCO2Kg: Number(project.proposedCO2Kg),
        approvedCO2Kg: Number(project.approvedCO2Kg),
        approved:      project.approved,
        blacklisted:   project.blacklisted,
        createdAt:     Number(project.createdAt),
    };
};

// ============================================================
// getListingOnChain
// Đọc thông tin listing từ blockchain
// ============================================================
const getListingOnChain = async (listingId) => {
    const { marketplaceContract } = getContracts();
    const listing = await marketplaceContract.listings(listingId);
    return {
        listingId:    Number(listing.listingId),
        projectId:    Number(listing.projectId),
        seller:       listing.seller,
        amount:       Number(listing.amount),
        pricePerUnit: ethers.formatEther(listing.pricePerUnit), // trả về ETH string
        active:       listing.active,
        createdAt:    Number(listing.createdAt),
    };
};

// ============================================================
// voteOnProject
// Validator vote duyệt dự án trên blockchain
// Params:
//   - onChainProjectId: projectId trên blockchain
//   - approve: true = duyệt, false = từ chối
// ============================================================
const voteOnProject = async (onChainProjectId, approve = true) => {
    const { marketplaceContract } = getValidatorContracts();
    const tx = await marketplaceContract.voteOnProject(
        onChainProjectId,
        approve
    );
    const receipt = await tx.wait(1);
    return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
    };
};
module.exports = {
    approveAndMintOnChain,
    addValidatorOnChain,
    removeValidatorOnChain,
    getProjectOnChain,
    getListingOnChain,
    voteOnProject,
};