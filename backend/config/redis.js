const redis = require('redis');

// Khởi tạo client kết nối với Redis Server (chạy ở cổng mặc định 6379)
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redisClient.on('error', (err) => console.error('❌ Lỗi kết nối Redis:', err.message));
redisClient.on('connect', () => console.log('✅ Đã kết nối thành công với Redis Cache!'));

module.exports = redisClient;