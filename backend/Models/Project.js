const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    projectName: {
        type: String,
        required: true,
    },
    ownerWallet: {
        type: String,
        required: true,
    },
    ipfsHash: {
        type: String,
        required: true,
    },
    totalCarbon: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    },

    // === THÊM MỚI: liên kết với blockchain ===
    // ID của dự án trên smart contract (từ event ProjectSubmitted)
    onChainProjectId: {
        type: Number,
        default: null,
        index: true,
    },
    // Lượng CO2 Admin xác nhận (kg) — điền sau khi approve
    approvedCO2Kg: {
        type: Number,
        default: null,
    },
    // Số token đang được niêm yết bán trên marketplace
    listedTokens: {
        type: Number,
        default: 0,
    },
    // Số token đã bán trên marketplace
    soldTokens: {
        type: Number,
        default: 0,
    },
    // ID listing hiện tại đang hoạt động trên marketplace
    activeListingId: {
        type: Number,
        default: null,
        index: true,
    },
    // Giá mỗi token (ETH string) của listing đang hoạt động
    pricePerCredit: {
        type: String,
        default: null,
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Project', projectSchema);
