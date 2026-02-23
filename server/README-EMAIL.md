# Cấu hình gửi email (Gửi cấu hình qua Email)

Để tính năng **Nhận thông tin cấu hình qua Email** hoạt động, cần cấu hình SMTP trong file `.env`.

## Các bước

1. **Tạo file `.env`** (nếu chưa có):
   ```bash
   cp .env.example .env
   ```

2. **Thêm hoặc sửa các biến trong `.env`**:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-char-app-password
   ```

3. **Lấy App Password (Gmail)**:
   - Vào [Google Account](https://myaccount.google.com) → Bảo mật
   - Bật **Xác minh 2 bước**
   - Mục **Mật khẩu ứng dụng** → Tạo mật khẩu cho "Mail" / "Other"
   - Dán chuỗi 16 ký tự vào `EMAIL_PASS`

4. **Trên Render (deployment)** – nếu vẫn báo "Chưa cấu hình email" hoặc 503:
   - Vào [Render Dashboard](https://dashboard.render.com) → chọn **service backend** (ví dụ `aurapc-backend`).
   - Tab **Environment** → **Environment Variables**.
   - Thêm (hoặc sửa):
     - Key: `EMAIL_USER` → Value: địa chỉ Gmail của bạn (vd. `you@gmail.com`).
     - Key: `EMAIL_PASS` → Value: App Password 16 ký tự (tạo ở bước 3).
   - Lưu → vào tab **Manual Deploy** → **Deploy latest commit** (hoặc push commit mới để auto deploy).
   - Đợi deploy xong rồi thử lại "Gửi cấu hình".

Sau khi cấu hình xong, nút **Gửi cấu hình** trong Aura Builder sẽ gửi PDF đến email người dùng nhập.
