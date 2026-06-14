const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Khai báo models khớp với chữ hoa trên máy bạn
const User = require('../Models/User'); 
const Transaction = require('../Models/Transaction'); 
const redisClient = require('../config/redis'); 

router.post('/transfer', async (req, res) => {
    const { senderId, receiverId, amount } = req.body;
    const numericAmount = Number(amount);

    console.log("\n=== 🔍 BẮT ĐẦU GIAO DỊCH ===");
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const sender = await User.findOne({ parentWalletAddress: senderId }).session(session);
        
        if (!sender) {
            throw new Error('Tài khoản gửi không tồn tại trong hệ thống');
        }

        if (sender.balance < numericAmount) {
            throw new Error(`Số dư không đủ. Hiện có: ${sender.balance}, Cần: ${numericAmount}`);
        }

        // Thực hiện bút toán trừ tiền
        sender.balance -= numericAmount;
        await sender.save({ session });

        const receiver = await User.findOne({ parentWalletAddress: receiverId }).session(session);
        if (!receiver) {
             throw new Error('Tài khoản nhận không tồn tại');
        }
        
        // Thực hiện bút toán cộng tiền
        receiver.balance += numericAmount;
        await receiver.save({ session });

        const newTransaction = new Transaction({
            txHash: "TXN_MOCK_" + Date.now(), 
            fromAddress: senderId, 
            toAddress: receiverId,
            amount: numericAmount,
            transactionType: "TRANSFER", 
            blockNumber: 999999,
            timestamp: new Date()
        });
        await newTransaction.save({ session });

        await session.commitTransaction();
        session.endSession();
        
        console.log("🎉 GIAO DỊCH THÀNH CÔNG!\n");
        res.status(200).json({ message: 'Chuyển Token thành công!', txHash: newTransaction.txHash });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("⛔ Giao dịch bị hoàn tác:", error.message, "\n");
        res.status(400).json({ error: 'Giao dịch thất bại, đã hoàn tác!', details: error.message });
    }
});

// ==========================================
// 2. API Lấy Lịch sử Giao dịch (Tối ưu Redis Caching)
// FRONTEND SẼ RẤT CẦN API NÀY ĐỂ HIỂN THỊ
// ==========================================
router.get('/history/:address', async (req, res) => {
    try {
        const address = req.params.address.toLowerCase();
        const cacheKey = `tx_history_${address}`; 

        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            console.log('⚡ Trả kết quả siêu tốc từ Redis Cache');
            return res.status(200).json(JSON.parse(cachedData));
        }

        console.log('🔍 Không có trong Cache, đang quét MongoDB...');
        const history = await Transaction.find({
            $or: [{ fromAddress: address }, { toAddress: address }]
        }).sort({ timestamp: -1 }); 

        if (history.length > 0) {
            await redisClient.setEx(cacheKey, 60, JSON.stringify(history));
        }

        res.status(200).json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi truy xuất lịch sử giao dịch' });
    }
});

module.exports = router;
