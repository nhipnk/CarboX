# 1. Sử dụng môi trường Node.js phiên bản tiêu chuẩn (Debian-based)
FROM node:20

# 2. Tạo thư mục làm việc bên trong container
WORKDIR /usr/src/app

# 3. Copy 2 file quản lý thư viện vào trước để tận dụng cache
COPY package*.json ./

# 4. Cài đặt các thư viện (node_modules)
RUN npm install --production

# 5. Copy toàn bộ mã nguồn dự án vào container
COPY . .

# 6. Mở cổng 5000 để giao tiếp ra bên ngoài
EXPOSE 5000

# 7. Lệnh khởi động server khi container chạy
CMD ["node", "server.js"]