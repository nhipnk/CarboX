const { ethers } = require('ethers');
const User = require('../Models/User');
const Project = require('../Models/Project');
const Transaction = require('../Models/Transaction');
const redisClient = require('../config/redis');
const marketplaceABI = require('../abis/CarbonMarketplace.json');

const invalidateTxHistoryCache = async (...addresses) => {
    if (!redisClient?.isOpen) return;
    const keys = addresses
        .filter(Boolean)
        .map((address) => `tx_history_${address.toLowerCase()}`);
    if (keys.length) {
        await redisClient.del(...keys);
    }
};

// ============================================================
// blockchainListener.js
// Lắng nghe TẤT CẢ events quan trọng từ CarbonMarketplace
// và đồng bộ dữ liệu vào MongoDB
// ============================================================

const listenToBlockchain = () => {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    const contract = new ethers.Contract(
        process.env.MARKETPLACE_CONTRACT_ADDRESS,
        marketplaceABI.abi,
        provider
    );

    console.log('🎧 Blockchain listener đang chạy, đang lắng nghe các events...');

    // ============================================================
    // EVENT: ProjectSubmitted
    // Khi chủ rừng submit dự án lên blockchain → UPDATE dự án trong MongoDB (đã tạo sẵn bởi frontend)
    // ============================================================
    contract.on('ProjectSubmitted', async (projectId, owner, projectURI, proposedCO2Kg, event) => {
        try {
            // FIX: Chỉ update existing project (frontend đã tạo sẵn)
            // Unique key: (ownerWallet, ipfsHash) — không create mới để tránh trùng lặp
            const existing = await Project.findOne({
                ownerWallet: owner.toLowerCase(),
                ipfsHash: projectURI,
            });

            if (existing) {
                // Update thêm onChainProjectId, giữ projectName mà frontend đã nhập
                await Project.findByIdAndUpdate(existing._id, {
                    onChainProjectId: Number(projectId),
                    totalCarbon: Number(proposedCO2Kg), 
                });
                console.log(`✅ Dự án "${existing.projectName}" (#${projectId}) được confirm trên blockchain`);
                return;
            }

            // Fallback: nếu frontend chưa tạo, listener sẽ tạo (nhưng thường không xảy ra)
            // Vì frontend tạo project TRƯỚC submitProject
            const newProject = await Project.create({
                onChainProjectId: Number(projectId),
                projectName: `Project #${projectId}`,
                ownerWallet: owner.toLowerCase(),
                ipfsHash: projectURI,
                totalCarbon: Number(proposedCO2Kg),
                status: 'Pending',
            });
            console.log(`📋 Dự án #${projectId} được tạo từ blockchain event (fallback)`);
        } catch (err) {
            if (err.code !== 11000) console.error('❌ Lỗi xử lý ProjectSubmitted:', err.message);
        }
    });

    // ============================================================
    // EVENT: ProjectApproved
    // Khi admin gọi approveAndMint → cập nhật status và lượng token
    // ============================================================
    contract.on('ProjectApproved', async (projectId, approvedBy, approvedCO2Kg, tokenAmount, event) => {
        try {
            await Project.findOneAndUpdate(
                { onChainProjectId: Number(projectId) },
                {
                    status: 'Approved',
                    approvedCO2Kg: Number(approvedCO2Kg),
                    totalCarbon: Number(tokenAmount),
                }
            );

            // Ghi lại giao dịch MINT vào Transaction
            const txHash = event.log?.transactionHash || 'MINT_' + Date.now();
            await Transaction.create({
                txHash,
                fromAddress: '0x0000000000000000000000000000000000000000',
                toAddress: approvedBy.toLowerCase(),
                amount: Number(tokenAmount),
                transactionType: 'MINT',
                blockNumber: event.log?.blockNumber || 0,
                timestamp: new Date(),
            }).catch(async (err) => {
                if (err.code !== 11000) throw err;
            });
            await invalidateTxHistoryCache(approvedBy.toLowerCase());

            console.log(`✅ Dự án #${projectId} được duyệt — mint ${tokenAmount} token`);
        } catch (err) {
            console.error('❌ Lỗi lưu ProjectApproved:', err.message);
        }
    });

    // ============================================================
    // EVENT: CreditsPurchased
    // Khi buyer mua token từ listing
    // ============================================================
    contract.on('CreditsPurchased', async (listingId, buyer, amount, totalPrice, fee, event) => {
        const txHash = event.log?.transactionHash || 'BUY_' + Date.now();
        try {
            const listing = await contract.listings(listingId);
            const projectId = Number(listing.projectId);
            const active = listing.active;

            const update = {
                $inc: {
                    soldTokens: Number(amount),
                    listedTokens: -Number(amount),
                },
            };
            if (!active) {
                update.activeListingId = null;
                update.pricePerCredit = null;
            }

            await Project.findOneAndUpdate(
                { onChainProjectId: projectId },
                update
            );

            await Transaction.create({
                txHash,
                fromAddress: buyer.toLowerCase(),
                toAddress: process.env.MARKETPLACE_CONTRACT_ADDRESS.toLowerCase(),
                amount: Number(amount),
                transactionType: 'TRANSFER',
                blockNumber: event.log?.blockNumber || 0,
                timestamp: new Date(),
            });
            await invalidateTxHistoryCache(buyer.toLowerCase(), process.env.MARKETPLACE_CONTRACT_ADDRESS.toLowerCase());
            console.log(`🛒 Mua ${amount} token bởi ${buyer} — listing #${listingId}`);
        } catch (err) {
            if (err.code !== 11000) console.error('❌ Lỗi lưu CreditsPurchased:', err.message);
        }
    });

    // ============================================================
    // EVENT: CreditsRetired
    // Khi buyer đốt token để lấy chứng nhận carbon
    // ============================================================
    contract.on('CreditsRetired', async (buyer, projectId, tokenAmount, co2Kg, certTokenId, event) => {
        const txHash = event.log?.transactionHash || 'RETIRE_' + Date.now();
        const buyerAddress = buyer.toLowerCase();
        const retiredTokenAmount = Number(tokenAmount);
        const retiredCO2Kg = Number(co2Kg);

        console.log(
            `CreditsRetired event received - buyer=${buyerAddress}, amount=${retiredTokenAmount}, co2Kg=${retiredCO2Kg}, cert #${certTokenId}`
        );

        try {
            // Cộng totalRetired cho user
            const updatedUser = await User.findOneAndUpdate(
                { parentWalletAddress: buyerAddress },
                {
                    $set: { parentWalletAddress: buyerAddress },
                    $setOnInsert: {
                        email: `${buyerAddress}@wallet.carbox.local`,
                        childWallets: [],
                        balance: 0,
                    },
                    $inc: { totalRetired: retiredCO2Kg },
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                    collation: { locale: 'en', strength: 2 },
                }
            );

            console.log(
                `User update success - buyer=${updatedUser.parentWalletAddress}, totalRetired=${updatedUser.totalRetired} kg CO2`
            );

            await Transaction.create({
                txHash,
                fromAddress: buyerAddress,
                toAddress: '0x0000000000000000000000000000000000000000',
                amount: retiredTokenAmount,
                transactionType: 'RETIRE',
                blockNumber: event.log?.blockNumber || 0,
                timestamp: new Date(),
            });
            await invalidateTxHistoryCache(buyerAddress);

            console.log(`🏆 Retire ${tokenAmount} token (${co2Kg} kg CO2) bởi ${buyer} — cert #${certTokenId}`);
        } catch (err) {
            if (err.code !== 11000) console.error('❌ Lỗi lưu CreditsRetired:', err.message);
        }
    });

    // ============================================================
    // EVENT: ListingCreated
    // Đồng bộ số token đang bán vào Project
    // ============================================================
    contract.on('ListingCreated', async (listingId, projectId, seller, amount, pricePerUnit, event) => {
        console.log(`🏪 Listing #${listingId} tạo bởi ${seller} — ${amount} token, dự án #${projectId}`);
        try {
            const pricePerCredit = ethers.formatEther(pricePerUnit);
            await Project.findOneAndUpdate(
                { onChainProjectId: Number(projectId) },
                {
                    $inc: { listedTokens: Number(amount) },
                    activeListingId: Number(listingId),
                    pricePerCredit,
                }
            );
        } catch (err) {
            console.error('❌ Lỗi cập nhật listedTokens khi ListingCreated:', err.message);
        }
    });

    // ============================================================
    // EVENT: ListingCancelled
    // Cập nhật số token còn lại khi listing bị hủy
    // ============================================================
    contract.on('ListingCancelled', async (listingId, event) => {
        console.log(`❌ Listing #${listingId} đã bị hủy`);
        try {
            const listing = await contract.listings(listingId);
            const projectId = Number(listing.projectId);
            const remaining = Number(listing.amount);
            await Project.findOneAndUpdate(
                { onChainProjectId: projectId },
                {
                    $inc: { listedTokens: -remaining },
                    activeListingId: null,
                    pricePerCredit: null,
                }
            );
        } catch (err) {
            console.error('❌ Lỗi cập nhật listedTokens khi ListingCancelled:', err.message);
        }
    });

    // ============================================================
    // EVENT: DisputeOpened / DisputeResolved
    // ============================================================
    contract.on('DisputeOpened', (listingId, initiator, reason, event) => {
        console.log(`⚖️  Tranh chấp mở trên listing #${listingId} bởi ${initiator}: ${reason}`);
    });

    contract.on('DisputeResolved', (listingId, sellerPenalized, event) => {
        console.log(`⚖️  Tranh chấp listing #${listingId} đã giải quyết — phạt seller: ${sellerPenalized}`);
    });

    // Xử lý lỗi kết nối provider
    provider.on('error', (err) => {
        console.error('🔌 Provider lỗi kết nối:', err.message);
    });
};

module.exports = listenToBlockchain;
