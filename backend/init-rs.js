const mongoose = require('mongoose');

async function initReplicaSet() {
    try {
        console.log("⏳ Đang kết nối tới MongoDB...");
        // Kết nối thẳng vào máy chủ cục bộ
        // Thay đổi 'carbonx' thành 'carbon_project'
        await mongoose.connect('mongodb://127.0.0.1:27017/carbon_project?directConnection=true');
        
        // Gọi quyền Admin của database
        const adminDb = mongoose.connection.db.admin();
        
        // Bắn lệnh kích hoạt Replica Set tên là 'rs0'
        console.log("⏳ Đang gửi lệnh kích hoạt Replica Set...");
        await adminDb.command({ 
            replSetInitiate: { 
                _id: "rs0", 
                members: [{ _id: 0, host: "127.0.0.1:27017" }] 
            } 
        });
        
        console.log("✅ BÙM! Khởi tạo Replica Set THÀNH CÔNG!");
        console.log("🚀 Bây giờ bạn đã có thể dùng Thunder Client để test API chuyển tiền (Rollback)!");
        process.exit(0);

    } catch (error) {
        // Bắt lỗi nếu lỡ kích hoạt thành công trước đó mà không biết
        if (error.codeName === 'AlreadyInitialized') {
            console.log("✅ Hệ thống báo: Replica Set đã được kích hoạt từ trước rồi, không cần làm gì thêm!");
            process.exit(0);
        } else {
            console.error("❌ Lỗi kích hoạt:", error.message);
            process.exit(1);
        }
    }
}

initReplicaSet();