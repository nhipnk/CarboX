const mongoose = require('mongoose');


const childWalletSchema = new mongoose.Schema({
  address: { 
    type: String, 
    required: true,
    trim: true 
  },
  label: { 
    type: String, 
    default: "Ví phụ" 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Định nghĩa cấu trúc cho User (Main document)
const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true // Đảm bảo email không bị trùng lặp
  },
  parentWalletAddress: { 
    type: String, 
    required: true,
    unique: true
  },
  // Nhúng trực tiếp mảng ví con vào trong User
  childWallets: [childWalletSchema], 
  
  notificationConfig: {
    emailAlerts: { type: Boolean, default: true },
    inAppAlerts: { type: Boolean, default: false }
  },

  // ---> TRƯỜNG QUẢN LÝ SỐ DƯ
  balance: {
    type: Number,
    default: 0
  },

  
  totalRetired: {
    type: Number,
    default: 0
  }

}, { timestamps: true }); // Tự động tạo trường createdAt và updatedAt

module.exports = mongoose.model('User', userSchema);