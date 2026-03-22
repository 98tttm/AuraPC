# AuraPC — Kịch Bản Quay Demo Đầy Đủ

> **Thời lượng ước tính**: 60–75 phút
> **Chuẩn bị**: Mở sẵn 3 tab — Client (localhost:4200), Admin (localhost:4201), Postman
> **Lưu ý**: Demo theo thứ tự, mỗi phần nối tiếp phần trước. Nói tiếng Việt khi quay.

---

## PHẦN 0 — CHUẨN BỊ TRƯỚC KHI QUAY (không quay)

- [ ] Chạy server: `cd server && npm run dev`
- [ ] Chạy client: `npx ng serve my-client`
- [ ] Chạy admin: `npx ng serve my-admin`
- [ ] Mở Postman, import collection (nếu có)
- [ ] Mở MongoDB Compass hoặc Atlas để show dữ liệu khi cần
- [ ] Đảm bảo có ít nhất: 1 tài khoản user, 1 admin, vài sản phẩm, 1 blog published, 1 bài hub approved
- [ ] Chuẩn bị 1 số điện thoại để đăng ký mới (demo OTP)
- [ ] Tắt các extension trình duyệt không cần thiết

---

## PHẦN A — GIAO DIỆN KHÁCH HÀNG (Client)
**Thời lượng: ~35–40 phút**

---

### A1. Trang chủ (Homepage) — 3 phút

1. **Mở trang chủ** `localhost:4200`
2. **Intro 3D animation** — Three.js canvas loading, hiệu ứng chữ AuraPC
3. **Scroll xuống** — Show các section:
   - Banner hero + nút "Khám phá ngay" → điều hướng tới `/ve-aurapc`
   - Sản phẩm nổi bật (Featured Products carousel)
   - Danh mục sản phẩm
4. **Header**: Logo, thanh tìm kiếm, icon giỏ hàng, nút đăng nhập
5. **Footer**: Thông tin liên hệ, link chính sách, social media
6. **Responsive**: Thu nhỏ trình duyệt → show mobile menu hamburger

---

### A2. Đăng ký / Đăng nhập (Auth + OTP) — 4 phút

1. **Bấm "Đăng nhập"** → trang `/dang-nhap`
2. **Nhập số điện thoại** (format 0xxxxxxxxx)
3. **Bấm gửi OTP** → show thông báo đã gửi
4. **Mở Postman** → Gọi `POST /api/auth/request-otp` body `{ "phoneNumber": "0901234567" }`
   - Chỉ ra response trả về `devOtp` (chế độ dev)
5. **Quay lại client**, nhập OTP → đăng nhập thành công
6. **Thử nhập sai 3 lần** (Postman) → show bị khóa 1 tiếng (brute-force protection)
7. **Show header đã đổi**: avatar, tên user, icon thông báo

---

### A3. Danh sách sản phẩm (Product List) — 4 phút

1. **Vào `/san-pham`** hoặc bấm "Sản phẩm" trên header
2. **Thanh tìm kiếm**: Gõ "RTX" → filter realtime
3. **Bộ lọc**:
   - Chọn danh mục (VGA, CPU, RAM,...)
   - Chọn hãng (ASUS, MSI,...)
   - Kéo thanh giá (price range slider)
   - Lọc theo thông số kỹ thuật (nếu có)
4. **Sắp xếp**: Giá tăng dần / giảm dần / Mới nhất
5. **Phân trang**: Bấm sang trang 2, 3
6. **Postman**: `GET /api/products?category=vga&brand=ASUS&sort=price_asc&page=1&limit=12`

---

### A4. Chi tiết sản phẩm (Product Detail) — 5 phút

1. **Bấm vào 1 sản phẩm** → `/san-pham/:slug`
2. **Hình ảnh**: Gallery ảnh, zoom hover
3. **3D Model Viewer**: Xoay 360° (nếu sản phẩm có model 3D)
4. **Thông tin**: Tên, giá gốc, giá sale, % giảm, tình trạng kho
5. **Thông số kỹ thuật**: Bảng specs chi tiết
6. **Mô tả HTML**: Nội dung mô tả từ nguồn
7. **Chọn số lượng**:
   - Bấm +/- để tăng giảm
   - **Nhập thủ công** số lượng vào ô input → show validation (không vượt stock)
8. **Bấm "Thêm vào giỏ"** → Toast thông báo thành công
9. **Đánh giá sản phẩm** (scroll xuống):
   - Thanh rating trung bình (sao)
   - Danh sách đánh giá của khách
   - Bấm "Viết đánh giá" (cần đã mua và nhận hàng)
   - Trả lời đánh giá (reply)
10. **Sản phẩm đã xem gần đây** (recently viewed section)

---

### A5. Giỏ hàng (Cart) — 3 phút

1. **Bấm icon giỏ hàng** → `/cart`
2. **Danh sách sản phẩm** trong giỏ: ảnh, tên, giá, số lượng
3. **Thay đổi số lượng**:
   - Bấm +/-
   - **Nhập thủ công** → validation stock
4. **Xóa sản phẩm** khỏi giỏ
5. **Tóm tắt đơn hàng**: Tổng tiền, phí vận chuyển
   - Thêm sản phẩm để tổng < 500.000₫ → hiển thị "Phí vận chuyển: 30.000₫"
   - Thêm sản phẩm để tổng ≥ 500.000₫ → "Miễn phí vận chuyển"
6. **Bấm "Thanh toán"** → chuyển sang checkout
7. **Postman**: `GET /api/cart` — show cart data trên server

---

### A6. Checkout + Thanh toán (Checkout) — 8 phút

#### A6.1 Trang Checkout

1. **Checkout stepper**: Step 1 → 2 → 3
2. **Địa chỉ giao hàng**:
   - Chọn từ danh sách địa chỉ đã lưu
   - Thêm địa chỉ mới (Tỉnh/Thành → Quận/Huyện → Phường/Xã)
   - Đặt làm mặc định
3. **Chọn phương thức thanh toán**: COD, QR/ATM, MoMo, ZaloPay
4. **Mã giảm giá**:
   - Nhập mã promotion → Bấm "Áp dụng"
   - Show số tiền được giảm
   - **Postman**: `POST /api/promotions/validate` body `{ "code": "SALE10", "orderAmount": 5000000 }`
5. **Tóm tắt**: Tổng tiền, giảm giá, phí vận chuyển, thành tiền

#### A6.2 Thanh toán COD (tiền mặt + OTP)

1. Chọn **COD** → Bấm đặt hàng
2. **Dialog OTP xác nhận** hiện lên → Nhập OTP
3. Đơn hàng tạo thành công → Chuyển tới `/checkout-success`
4. **Trang thành công**: Mã đơn hàng, nút "Tải hóa đơn PDF", link tra cứu

#### A6.3 Thanh toán QR/ATM (chuyển khoản)

1. Chọn **QR/ATM** → Bấm thanh toán
2. Trang `/checkout-qr-payment`: QR code ngân hàng, nội dung chuyển khoản
3. Show phí vận chuyển động (miễn phí nếu ≥ 500k)
4. Bấm "Tôi đã thanh toán" → Tạo đơn → Success page

#### A6.4 Thanh toán MoMo

1. Chọn **Ví MoMo** → Bấm thanh toán
2. **Mock mode** (demo): Redirect thẳng tới trang xác nhận không qua MoMo API
3. Trang `/checkout-momo-return`: Kết quả thanh toán, mã đơn
4. Nút **"Tải hóa đơn PDF"** → Download file invoice
5. **Postman**: `POST /api/payment/momo/create` — show pending payment flow

#### A6.5 Thanh toán ZaloPay

1. Chọn **ZaloPay** → Bấm thanh toán
2. Trang `/checkout-zalopay-payment`: QR code ZaloPay, nội dung thanh toán
3. Bấm xác nhận → Trang `/checkout-zalopay-return`
4. Nút **"Tải hóa đơn PDF"**
5. **Postman**: `POST /api/payment/zalopay/create` — show ZaloPay API integration

---

### A7. Quản lý tài khoản (Account) — 4 phút

1. **Vào `/tai-khoan`**
2. **Tab Hồ sơ**:
   - Sửa họ tên, email, ngày sinh, giới tính
   - Upload avatar → preview + lưu
3. **Tab Đơn hàng**:
   - Danh sách đơn hàng với filter theo trạng thái (Tất cả, Chờ xác nhận, Đang xử lý, Đang giao, Đã giao, Đã hủy)
   - Bấm vào 1 đơn → Chi tiết đơn hàng
   - **Yêu cầu hủy đơn** (đơn pending/confirmed)
   - **Xác nhận đã nhận hàng** (đơn shipped) → Tạo serial number bảo hành
   - **Yêu cầu trả hàng** (đơn delivered)
   - **Tải hóa đơn PDF** cho mỗi đơn
4. **Tab Địa chỉ**:
   - Danh sách địa chỉ
   - Thêm / Sửa / Xóa / Đặt mặc định
5. **Tab Thông báo**:
   - Danh sách thông báo (đơn hàng xác nhận, đang giao,...)
   - Đánh dấu đã đọc / đọc tất cả

---

### A8. Tra cứu đơn hàng + Bảo hành — 2 phút

1. **Tra cứu đơn hàng** `/tra-cuu-don-hang`:
   - Nhập mã đơn hàng (AP-xxx) → Show trạng thái, chi tiết
   - Không cần đăng nhập
2. **Tra cứu bảo hành** `/tra-cuu-bao-hanh`:
   - Nhập serial number (APC-xxx) hoặc mã đơn hàng
   - Show thông tin bảo hành: sản phẩm, ngày mua, hạn bảo hành, trạng thái

---

### A9. AuraBuilder — PC Configurator — 5 phút

1. **Vào `/aura-builder`**
2. **13 bước chọn linh kiện**: GPU → CPU → Mainboard → Case → Tản nhiệt → RAM → Ổ cứng → PSU → Fan → Màn hình → Bàn phím → Chuột → Tai nghe
3. **Mỗi bước**:
   - Danh sách sản phẩm tương thích
   - Tìm kiếm / lọc
   - Chọn sản phẩm → hiển thị giá, specs
4. **Tổng giá cấu hình** cập nhật realtime
5. **Chia sẻ cấu hình**: Tạo link share (7 ngày TTL)
6. **Mở link share** ở tab ẩn danh → load cấu hình (không cần đăng nhập)
7. **Xuất PDF**: Bấm nút → download PDF cấu hình
8. **Gửi email**: Bấm gửi → email cấu hình PDF về mail user
9. **Postman**: `GET /api/builder/:shareId` — show builder data

---

### A10. AuraHub — Cộng đồng — 4 phút

1. **Vào `/aura-hub`**
2. **Feed bài đăng**: Scroll infinite load
3. **Lọc theo topic** (Thảo luận, Chia sẻ, Hỏi đáp,...)
4. **Sắp xếp**: Mới nhất / Trending
5. **Đăng bài mới**:
   - Viết nội dung
   - Upload ảnh (tối đa 5 ảnh, 10MB/ảnh)
   - Tạo poll (khảo sát) nếu muốn
   - Bấm đăng → Trạng thái "Chờ duyệt" (pending)
6. **Tương tác bài đăng**:
   - Like / Unlike
   - Bình luận + trả lời bình luận
   - Repost
   - Chia sẻ link
   - Vote poll
7. **Profile user**: Bấm vào avatar → xem bài đăng, followers, following
8. **Follow / Unfollow** user khác

---

### A11. AruBot — Chatbot AI — 3 phút

1. **Bấm icon chat** góc phải → Widget chatbot mở lên
2. **Hỏi chatbot**:
   - "Tư vấn cho tôi VGA tầm 10 triệu" → Bot gợi ý sản phẩm thật từ DB
   - "So sánh RTX 4060 và RTX 4070" → Bot phân tích
   - "Case nào đẹp nhất?" → Bot trả lời + hiển thị card sản phẩm
3. **Bấm vào sản phẩm** trong chat → Điều hướng tới trang chi tiết sản phẩm
4. **Postman**: `POST /api/chat` body `{ "message": "Tư vấn VGA gaming" }` → Show response có `reply` + `products[]`

---

### A12. Blog — 1 phút

1. **Vào `/blog`** → Danh sách bài viết
2. **Bấm vào 1 bài** → `/blog/:slug` → Nội dung đầy đủ
3. **Responsive**: Xem trên mobile

---

### A13. Hỗ trợ trực tuyến (Support Chat) — 2 phút

1. **Bấm icon chat hỗ trợ** (khác với AruBot)
2. **Gửi tin nhắn** cho admin → Tin nhắn gửi realtime (Socket.io)
3. **(Sẽ demo phía admin nhận tin nhắn ở Phần B)**

---

### A14. Các trang nội dung — 1 phút

1. `/ve-aurapc` — Giới thiệu AuraPC
2. `/ve-aurapc/chinh-sach-bao-mat-du-lieu-ca-nhan` — Chính sách bảo mật
3. `/ho-tro` — Trang hỗ trợ + FAQ
4. `/collabs/minecraft` — Trang campaign Minecraft collab

---

## PHẦN B — GIAO DIỆN QUẢN TRỊ (Admin)
**Thời lượng: ~20–25 phút**

---

### B1. Đăng nhập Admin — 1 phút

1. **Mở `localhost:4201`** → Trang login
2. **Đăng nhập**: email admin + mật khẩu
3. **Postman**: `POST /api/admin/auth/login` body `{ "email": "thinhtt@st.uel.edu.vn", "password": "0" }` → JWT token

---

### B2. Dashboard — 3 phút

1. **4 KPI cards**: Tổng doanh thu, Doanh thu tháng này (so sánh tháng trước %), Tổng đơn hàng, Tổng khách hàng
2. **Biểu đồ doanh thu** (Area chart): Doanh thu + khách mới theo tháng (12 tháng)
3. **Biểu đồ đơn hàng** (Line chart): Đơn hàng theo ngày (7 ngày gần nhất)
4. **Biểu đồ tuần**: Doanh thu + đơn + khách theo tuần trong tháng
5. **Top sản phẩm bán chạy** (Bar chart)
6. **Biểu đồ trạng thái đơn** (Doughnut chart)
7. **Đơn hàng gần đây** (Table): 10 đơn mới nhất
8. **Toggle Dark/Light mode** — Bấm nút theme → UI chuyển đổi
9. **Postman**: `GET /api/admin/dashboard/stats` (kèm header `Authorization: Bearer <token>`)

---

### B3. Quản lý Sản phẩm — 4 phút

1. **Danh sách sản phẩm** `/products`:
   - Tìm kiếm theo tên / brand
   - Filter: Danh mục, Hãng (dropdown riêng), Tình trạng kho (còn hàng / sắp hết / hết hàng)
   - Sắp xếp theo cột
   - Phân trang
2. **Thêm sản phẩm** `/products/new`:
   - Nhập: tên, slug (tự generate), giá, giá sale, danh mục, hãng, mô tả
   - Upload ảnh
   - Thêm thông số kỹ thuật
   - Số lượng kho, bảo hành
   - Bấm Lưu
3. **Sửa sản phẩm** → Bấm icon edit → Form điền sẵn → Sửa giá → Lưu
4. **Xóa sản phẩm** → Confirm dialog → Xóa
5. **Postman**:
   - `GET /api/admin/products?search=RTX&page=1`
   - `GET /api/admin/products/brands` → danh sách hãng
   - `GET /api/admin/products/stock-stats` → thống kê kho

---

### B4. Quản lý Đơn hàng — 4 phút

1. **Danh sách đơn** `/orders`:
   - Filter: Trạng thái, khoảng ngày, tìm kiếm (mã đơn, tên, SĐT)
   - Phân trang
2. **Chi tiết đơn** → Bấm vào 1 đơn:
   - Timeline trạng thái (stepper)
   - Thông tin khách, sản phẩm, thanh toán
   - **Cập nhật trạng thái**: pending → processing → shipped
   - Stock tự động trừ khi chuyển "shipped"
3. **Xử lý yêu cầu hủy**:
   - Đơn có yêu cầu hủy → Bấm "Duyệt" hoặc "Từ chối"
   - Nếu duyệt → Stock hoàn lại
4. **Xử lý yêu cầu trả hàng**: Tương tự
5. **Admin hủy đơn**: Bấm "Hủy đơn" → Stock hoàn lại
6. **Postman**:
   - `GET /api/admin/orders?status=pending`
   - `PUT /api/admin/orders/:orderNumber/status` body `{ "status": "processing" }`

---

### B5. Quản lý Khách hàng — 2 phút

1. **Danh sách khách** `/users`:
   - Tìm kiếm theo SĐT, tên, email
   - Biểu đồ phân khúc khách hàng
   - Số đơn mỗi khách
2. **Chi tiết khách** → Bấm vào 1 khách:
   - Hồ sơ: tên, SĐT, email, ngày sinh
   - 10 đơn hàng gần nhất
   - Tổng chi tiêu
3. **Postman**: `GET /api/admin/users?search=0901`

---

### B6. Quản lý Blog — 2 phút

1. **Danh sách bài** `/blogs`: Filter draft / published
2. **Tạo bài mới** `/blogs/new`:
   - Tiêu đề, slug tự generate
   - Editor nội dung (HTML)
   - Cover image tự extract từ content
   - Published / Draft toggle
3. **Sửa / Xóa bài**
4. **Postman**: `POST /api/admin/blogs` body `{ "title": "Test Blog", "content": "<p>Nội dung</p>", "published": true }`

---

### B7. Quản lý Danh mục — 1 phút

1. **Danh sách danh mục** `/categories`: Tree structure
2. **Thêm / Sửa / Xóa** danh mục
3. **Parent category**: Chọn danh mục cha cho cây đa cấp

---

### B8. Duyệt bài AuraHub (Moderation) — 2 phút

1. **Vào `/hub`** → Tab "Chờ duyệt"
2. **Xem bài chờ duyệt**: Nội dung, ảnh, người đăng
3. **Duyệt bài** → Bấm "Approve" → Bài hiển thị trên Hub
4. **Từ chối bài** → Nhập lý do → Bấm "Reject"
5. **Xóa bài** (vi phạm nghiêm trọng)
6. **Xóa bình luận** vi phạm
7. **Postman**: `PATCH /api/admin/hub/posts/:id/approve`

---

### B9. Quản lý Mã giảm giá (Promotions) — 2 phút

1. **Danh sách mã** `/promotions`
2. **Tạo mã mới** `/promotions/new`:
   - Code (tự uppercase), % giảm, giảm tối đa, đơn tối thiểu
   - Giới hạn sử dụng (tổng + per user)
   - Ngày bắt đầu / kết thúc
   - Active / Inactive
3. **Sửa / Xóa mã**
4. **Postman**: `POST /api/admin/promotions` body `{ "code": "DEMO50", "discountPercent": 50, "maxDiscountAmount": 500000, "startDate": "...", "endDate": "..." }`

---

### B10. Quản lý Bảo hành (Warranty) — 2 phút

1. **Vào `/warranty`**
2. **Thống kê**: Tổng bảo hành, Còn hiệu lực, Hết hạn
3. **Tìm kiếm**: Serial number, mã đơn, tên sản phẩm, tên khách
4. **Filter**: Còn hiệu lực / Hết hạn
5. **Bảng chi tiết**: Serial, sản phẩm, khách, ngày mua, hạn BH, trạng thái
6. **Postman**:
   - `GET /api/admin/warranty?status=valid&search=APC`
   - `GET /api/admin/warranty/stats`

---

### B11. Hỗ trợ trực tuyến (Admin Support Chat) — 2 phút

1. **Vào `/support`** → Inbox hội thoại
2. **Tab**: Đang mở / Đã lưu trữ
3. **Chọn 1 cuộc hội thoại** → Đọc lịch sử chat
4. **Gửi phản hồi** → Tin nhắn gửi realtime tới user (Socket.io)
5. **Demo 2 chiều**: Mở client tab → gửi tin → Admin tab nhận ngay
6. **Archive** cuộc hội thoại khi xong
7. **Postman**: `GET /api/admin/support?tab=open`

---

### B12. Thông báo Admin — 1 phút

1. **Icon bell trên header** → Số thông báo chưa đọc
2. **Dropdown thông báo**: Đơn hàng mới, yêu cầu hủy, yêu cầu trả hàng
3. **Đánh dấu đã đọc** / Đọc tất cả
4. **Bấm vào thông báo** → Điều hướng tới đơn hàng tương ứng

---

### B13. Giao diện Admin — 1 phút

1. **Dark mode / Light mode**: Toggle → Toàn bộ UI chuyển đổi
2. **Sidebar**: Thu gọn (icon-only 64px) / Mở rộng (full 220px)
3. **Responsive**: Mobile sidebar, hamburger menu
4. **Logo** thay đổi theo theme (dark/light)

---

## PHẦN C — POSTMAN API TESTING
**Thời lượng: ~10–15 phút**

> Demo các API endpoint quan trọng, show request/response

---

### C1. Authentication APIs — 2 phút

```
POST /api/auth/request-otp
Body: { "phoneNumber": "0901234567" }
→ Show devOtp trong response

POST /api/auth/verify-otp
Body: { "phoneNumber": "0901234567", "otp": "123456" }
→ Show JWT token, user data

GET /api/auth/me  (Bearer token)
→ Show user profile
```

---

### C2. Product APIs — 2 phút

```
GET /api/products?page=1&limit=5
→ Show pagination, product list

GET /api/products?category=vga&brand=ASUS&minPrice=5000000&maxPrice=20000000
→ Show filtering

GET /api/products/featured
→ Show featured products

GET /api/products/by-slug/vga-msi-rtx-4060
→ Show single product detail

GET /api/products/filter-options?category=vga
→ Show available brands, specs for filtering
```

---

### C3. Order APIs — 2 phút

```
POST /api/orders (Bearer token)
Body: {
  "items": [{ "product": "<productId>", "quantity": 1 }],
  "shippingAddress": { "fullName": "Demo", "phone": "0901234567", "address": "...", "city": "...", "district": "...", "ward": "..." },
  "paymentMethod": "cod"
}
→ Show order created, server-side price verification

GET /api/orders (Bearer token)
→ Show user's order list

GET /api/orders/track/AP-xxxxxx
→ Show public order tracking (no auth)

GET /api/orders/AP-xxxxxx/invoice
→ Download PDF invoice binary
```

---

### C4. Cart APIs — 1 phút

```
POST /api/cart/add (Bearer token)
Body: { "productId": "<id>", "quantity": 2 }
→ Show cart updated

GET /api/cart (Bearer token)
→ Show cart with product details, prices
```

---

### C5. Payment APIs — 2 phút

```
POST /api/payment/momo/create (Bearer token)
Body: { "items": [...], "shippingAddress": {...}, "promotionCode": "SALE10" }
→ Show payUrl (mock mode) or MoMo redirect URL

POST /api/payment/zalopay/create (Bearer token)
Body: { ... }
→ Show ZaloPay order_url

POST /api/promotions/validate
Body: { "code": "SALE10", "orderAmount": 5000000, "userId": "..." }
→ Show discount calculation
```

---

### C6. Builder APIs — 1 phút

```
POST /api/builder (Bearer token)
Body: { "components": {} }
→ Show builder created with _id

PUT /api/builder/:id (Bearer token)
Body: { "step": "GPU", "component": { "product": "<id>", "name": "RTX 4070", "price": 15000000 } }
→ Show component added

GET /api/builder/:shareId
→ Show shared builder config (public)
```

---

### C7. Hub & Chat APIs — 2 phút

```
GET /api/hub/posts?sort=trending&limit=5
→ Show trending posts

POST /api/hub/posts (Bearer token)
Body: { "content": "Test post", "topic": "Thảo luận" }
→ Show post created with status "pending"

POST /api/chat
Body: { "message": "Tư vấn laptop gaming 20 triệu" }
→ Show AI reply + matched products from DB
```

---

### C8. Admin APIs — 2 phút

```
POST /api/admin/auth/login
Body: { "email": "thinhtt@st.uel.edu.vn", "password": "0" }
→ Show admin JWT

GET /api/admin/dashboard/stats (Admin Bearer)
→ Show KPI data: revenue, orders, users

GET /api/admin/dashboard/chart/revenue?months=6 (Admin Bearer)
→ Show monthly revenue data

GET /api/admin/orders?status=pending (Admin Bearer)
→ Show pending orders list

PUT /api/admin/orders/:orderNumber/status (Admin Bearer)
Body: { "status": "processing" }
→ Show status updated

GET /api/admin/warranty/stats (Admin Bearer)
→ Show warranty statistics
```

---

## PHẦN D — LUỒNG NGHIỆP VỤ LIÊN THÔNG (End-to-End Flow)
**Thời lượng: ~5–8 phút**

> Demo 1 luồng hoàn chỉnh từ đầu đến cuối, liên kết Client + Admin + Postman

---

### D1. Luồng mua hàng hoàn chỉnh — 5 phút

1. **[Client]** Đăng nhập → Chọn sản phẩm → Thêm giỏ hàng
2. **[Client]** Checkout → Chọn địa chỉ → Nhập mã giảm giá → Chọn COD → Xác nhận OTP
3. **[Client]** Trang thành công → Tải hóa đơn PDF → Mở file PDF
4. **[Admin]** Dashboard → Thấy đơn hàng mới + thông báo
5. **[Admin]** Chi tiết đơn → Xác nhận → Chuyển "Đang xử lý" → "Đang giao"
6. **[Client]** Tài khoản → Tab đơn hàng → Thấy trạng thái "Đang giao"
7. **[Client]** Bấm "Đã nhận hàng" → Serial number bảo hành được tạo
8. **[Client]** Tra cứu bảo hành → Nhập serial → Show thông tin bảo hành
9. **[Admin]** Trang bảo hành → Thấy bảo hành mới
10. **[Client]** Viết đánh giá sản phẩm (đã mua)

---

### D2. Luồng hủy đơn — 2 phút

1. **[Client]** Tạo đơn hàng mới (COD)
2. **[Client]** Tài khoản → Yêu cầu hủy → Nhập lý do
3. **[Admin]** Thông báo "Yêu cầu hủy" → Mở đơn → Duyệt hủy
4. **[Client]** Thấy đơn đã hủy, stock hoàn lại

---

### D3. Luồng Hub cộng đồng — 1 phút

1. **[Client]** Đăng bài Hub → Trạng thái "Chờ duyệt"
2. **[Admin]** Hub moderation → Duyệt bài
3. **[Client]** Bài xuất hiện trên feed → Like, bình luận

---

## TÓM TẮT TIMELINE

| Thời gian | Phần | Nội dung |
|-----------|------|----------|
| 0:00 – 0:03 | A1 | Trang chủ + 3D |
| 0:03 – 0:07 | A2 | Đăng ký / Đăng nhập OTP |
| 0:07 – 0:11 | A3 | Danh sách sản phẩm + Filter |
| 0:11 – 0:16 | A4 | Chi tiết sản phẩm + 3D + Review |
| 0:16 – 0:19 | A5 | Giỏ hàng |
| 0:19 – 0:27 | A6 | Checkout + 4 phương thức thanh toán |
| 0:27 – 0:31 | A7 | Quản lý tài khoản |
| 0:31 – 0:33 | A8 | Tra cứu đơn hàng + Bảo hành |
| 0:33 – 0:38 | A9 | AuraBuilder |
| 0:38 – 0:42 | A10 | AuraHub cộng đồng |
| 0:42 – 0:45 | A11 | AruBot chatbot AI |
| 0:45 – 0:46 | A12 | Blog |
| 0:46 – 0:48 | A13 | Support chat |
| 0:48 – 0:49 | A14 | Trang nội dung |
| 0:49 – 0:50 | B1 | Admin đăng nhập |
| 0:50 – 0:53 | B2 | Dashboard + Biểu đồ |
| 0:53 – 0:57 | B3 | Quản lý sản phẩm |
| 0:57 – 1:01 | B4 | Quản lý đơn hàng |
| 1:01 – 1:03 | B5 | Quản lý khách hàng |
| 1:03 – 1:05 | B6 | Quản lý blog |
| 1:05 – 1:06 | B7 | Quản lý danh mục |
| 1:06 – 1:08 | B8 | Duyệt bài Hub |
| 1:08 – 1:10 | B9 | Quản lý mã giảm giá |
| 1:10 – 1:12 | B10 | Quản lý bảo hành |
| 1:12 – 1:14 | B11 | Admin support chat |
| 1:14 – 1:15 | B12-13 | Thông báo + UI theme |
| 1:15 – 1:25 | C | Postman API testing |
| 1:25 – 1:33 | D | Luồng End-to-End |

---

## MẸO KHI QUAY DEMO

1. **Mở sẵn nhiều tab**: Client, Admin, Postman — xếp side by side khi demo realtime (support chat, notification)
2. **Dùng Zoom hoặc Windows Magnifier** để phóng to vùng quan trọng
3. **Tắt notification máy** (Focus Assist / Do Not Disturb)
4. **Chuẩn bị dữ liệu trước**: Có sẵn đơn hàng ở các trạng thái khác nhau để demo
5. **Nói rõ từng bước**: "Bây giờ mình sẽ demo tính năng X..."
6. **Highlight điểm kỹ thuật**: Server-side price verification, OTP brute-force protection, MongoDB TTL, Socket.io realtime
7. **Show responsive**: Thu nhỏ trình duyệt ít nhất 1-2 lần
8. **Postman trước hoặc sau mỗi phần**: Gọi API tương ứng để thầy thấy backend hoạt động
