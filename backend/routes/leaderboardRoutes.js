const express = require('express');
const router = express.Router();

const User = require('../Models/User'); 

// ==========================================
// API LẤY BẢNG XẾP HẠNG DOANH NGHIỆP XANH
// URL: GET /api/leaderboard
// ==========================================
router.get('/', async (req, res) => {
    try {
        // Tìm các user có lượng đốt > 0, sắp xếp giảm dần (-1) và lấy Top 10
        const topBurners = await User.find({
            totalRetired: { $gt: 0 },
            parentWalletAddress: { $exists: true, $ne: '' }
        })
                                     .sort({ totalRetired: -1 })
                                     .limit(10)
                                     .select('parentWalletAddress totalRetired -_id'); // Chỉ trả về Ví và Số lượng

        const leaderboard = topBurners.map((user) => ({
            parentWalletAddress: String(user.parentWalletAddress).toLowerCase(),
            totalRetired: Number(user.totalRetired) || 0
        }));

        res.status(200).json({
            message: "🏆 Bảng xếp hạng Doanh nghiệp bù đắp Carbon",
            leaderboard
        });
    } catch (error) {
        console.error("❌ Lỗi truy xuất Leaderboard:", error);
        res.status(500).json({ error: 'Không thể tải bảng xếp hạng.' });
    }
});

module.exports = router;
