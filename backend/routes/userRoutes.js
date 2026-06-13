const express = require('express');
const router = express.Router();
const User = require('../Models/User');

// API Nhận dữ liệu và Tạo tài khoản mới (Đã bảo mật Mass Assignment)
router.post('/create', async (req, res) => {
    try {
        // [BỔ SUNG] Bóc tách chính xác các trường được phép nhận từ Frontend
        const { email, parentWalletAddress, childWallets, notificationConfig } = req.body;
        
        // Kiểm tra dữ liệu bắt buộc
        if (!email || !parentWalletAddress) {
            return res.status(400).json({ error: 'Thiếu email hoặc địa chỉ ví chính!' });
        }

        // Tạo User mới, ép cứng balance và totalRetired bằng 0 để chống hack
        const newUser = new User({
            email,
            parentWalletAddress,
            childWallets: childWallets || [],
            notificationConfig: notificationConfig || {},
            balance: 0,       // Khóa cứng: Tiền mặc định bằng 0
            totalRetired: 0   // Khóa cứng: Thành tích mặc định bằng 0
        }); 
        
        const savedUser = await newUser.save(); 
        
        res.status(201).json({
            message: 'Tạo tài khoản thành công!',
            user: savedUser
        }); 
    } catch (error) {
        // Bắt lỗi trùng email hoặc trùng ví (do setup 'unique: true' trong Model)
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Email hoặc địa chỉ ví này đã tồn tại trong hệ thống!' });
        }
        res.status(400).json({ error: 'Lỗi tạo tài khoản', details: error.message });
    }
});

// API Lấy danh sách toàn bộ người dùng
router.get('/', async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi server' });
    }
});

module.exports = router;