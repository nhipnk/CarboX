const mongoose = require('mongoose');
const transactionSchema = new mongoose.Schema({
  txHash: { 
    type: String, 
    required: true, 
    unique: true, // Mã băm giao dịch trên Blockchain là duy nhất
    index: true 
  },
  fromAddress: { 
    type: String, 
    required: true,
    index: true // Đánh index để truy vấn nhanh ví người gửi
  },
  toAddress: { 
    type: String, 
    required: true,
    index: true // Đánh index để truy vấn nhanh ví người nhận/Contract
  },
  amount: { 
    type: Number, 
    required: true 
  },
  transactionType: { 
    type: String, 
    enum: ['MINT', 'TRANSFER', 'RETIRE'], // Chỉ cho phép 3 loại giao dịch này
    required: true 
  },
  ipfsHash: { 
    type: String, 
    default: null // Mã băm từ Pinata (nếu có tài liệu đính kèm)
  },
  listingId: {
    type: Number,
    default: null // Chỉ có giá trị với giao dịch TRANSFER (mua từ marketplace)
  },
  blockNumber: { 
    type: Number, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    required: true 
  }
});
module.exports = mongoose.model('Transaction', transactionSchema);
