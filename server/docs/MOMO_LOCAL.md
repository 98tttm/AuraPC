# MoMo thật trên máy local (sandbox) — deploy vẫn dùng mock

Mục tiêu: **trên máy bạn** gọi API MoMo sandbox (mở trang MoMo / ví thật trong môi trường test). **Render + Vercel production** giữ `MOMO_MOCK_MODE=true` như hiện tại — không cần đổi code, chỉ khác biến môi trường.

## Điều kiện

- Bộ **Partner Code / Access Key / Secret Key** từ [MoMo M4B / Payment Integration Center](https://business.momo.vn/sanpham/portal/payment-integration-center) (môi trường **Test**).
- Trong cấu hình MoMo (sandbox), **whitelist** return URL:
  - `http://localhost:4200/checkout-momo-return`

## 1. `server/.env` (chỉ máy bạn — không commit)

```env
NODE_ENV=development
FRONTEND_URL=http://localhost:4200

# MoMo sandbox thật trên local
MOMO_MOCK_MODE=false
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_REDIRECT_URL=http://localhost:4200/checkout-momo-return
MOMO_PARTNER_CODE=...
MOMO_ACCESS_KEY=...
MOMO_SECRET_KEY=...
MOMO_PARTNER_NAME=AuraPC
MOMO_STORE_ID=AuraPC-Local

# IPN: MoMo gọi server bạn — localhost không ra internet được.
# Cách 1 (đủ cho hầu hết test): để tạm URL public qua ngrok:
#   ngrok http 3000
#   MOMO_IPN_URL=https://xxxx.ngrok-free.app/api/payment/momo/ipn
# Cách 2: bỏ qua IPN khi test — sau khi thanh toán, user vẫn redirect về
#   /checkout-momo-return và frontend gọi GET /api/payment/momo/confirm (cần đã đăng nhập).
```

**Lưu ý:** Mỗi lần URL ngrok đổi, cập nhật lại `MOMO_IPN_URL` và (nếu MoMo yêu cầu) whitelist trong portal.

## 2. Chạy app

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — Angular (dùng environment.development → API localhost:3000)
npx ng serve my-client
```

Mở `http://localhost:4200`, đăng nhập, checkout chọn MoMo → phải redirect sang **trang thanh toán MoMo** (không còn toast “chế độ demo”).

## 3. Render / Vercel (giữ như cũ)

Trên **Render** không đổi gì nếu bạn muốn tiếp tục demo:

- `MOMO_MOCK_MODE=true`
- `FRONTEND_URL` + redirect URL đúng domain deploy

File `server/.env` **không** đẩy lên git; production chỉ dùng env trên Render.

## 4. Lỗi thường gặp

| Hiện tượng | Hướng xử lý |
|------------|-------------|
| `resultCode` khác 0 / từ chối tạo giao dịch | Kiểm tra 3 key sandbox đúng **một** merchant; không trộn bộ mẫu cũ. |
| Redirect về localhost bị MoMo chặn | Whitelist đúng URL return trên portal test. |
| Confirm lỗi 401 | Phải **đăng nhập** cùng tài khoản lúc tạo đơn trước khi quay lại từ MoMo. |
| IPN không tới | Bình thường nếu chưa dùng ngrok; dựa vào luồng redirect + `/momo/confirm`. |
