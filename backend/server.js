require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import routes & services
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const projectRoutes = require('./routes/projectRoutes');
const listenToBlockchain = require('./services/blockchainListener');
const transactionRoutes = require('./routes/transactionRoutes'); 
const userRoutes = require('./routes/userRoutes');
const uploadRoutes = require('./routes/uploadRoutes'); 

// Import config (Kết nối hệ thống phụ)
const redisClient = require('./config/redis'); 

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); 

// Route kiểm tra trạng thái
app.get('/api/status', (req, res) => {
  res.json({ message: 'Server Backend Dự án Carbon Token đang hoạt động tốt!' });
});

// Các route chính
app.use('/api/transactions', transactionRoutes); 
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes); 
app.use('/api/projects', projectRoutes);
app.use('/api/leaderboard', leaderboardRoutes);


const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log('⏳ Đang tiến hành kết nối với MongoDB Replica Set...');
    
    // [FIX] Thêm timeout options để báo lỗi rõ hơn nếu vẫn mất kết nối
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Đã kết nối thành công với MongoDB Replica Set!');
    
    // Lắng nghe blockchain
    listenToBlockchain();
    
    // Kết nối Redis
    await redisClient.connect();
    console.log('✅ Đã kết nối thành công với Redis Cache!');
    
    // Khởi động server
    app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Lỗi khởi động hệ thống:', err.message);
    process.exit(1); 
  }
};

startServer();
