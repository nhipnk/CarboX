const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

// Cấu hình lưu file tạm vào RAM để tối ưu tốc độ
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn file 5MB
});

router.post('/ipfs', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Vui lòng đính kèm file (key: document)' });
        }

        // Tạo cục dữ liệu chuẩn form-data
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });

        // Bắn dữ liệu lên máy chủ Pinata
        const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
            headers: {
                'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
                'pinata_api_key': process.env.PINATA_API_KEY,
                'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY
            }
        });

        // Trả về kết quả chứa mã băm CID
        res.status(200).json({
            message: 'Đẩy báo cáo lên IPFS thành công!',
            ipfsHash: response.data.IpfsHash, 
            timestamp: response.data.Timestamp
        });

    } catch (error) {
        console.error('Lỗi Pinata:', error.response?.data || error.message);
        res.status(500).json({ error: 'Lỗi hệ thống khi tải file lên mạng lưới' });
    }
});

module.exports = router;