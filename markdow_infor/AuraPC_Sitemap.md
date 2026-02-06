# AuraPC - Sitemap Hoàn Chỉnh

## 🏠 CLIENT SITE (Trang Khách Hàng)

### 1. Trang Chủ (Homepage)
- `/` - Trang chủ
  - Hero section (Banner chính)
  - Sản phẩm nổi bật
  - Danh mục sản phẩm chính
  - Tin tức/Khuyến mãi mới nhất
  - Video giới thiệu
  - Testimonials (Đánh giá khách hàng)

### 2. Danh Mục Sản Phẩm (Product Categories)
- `/products` - Tất cả sản phẩm
  - `/products/cpu` - CPU
  - `/products/motherboard` - Mainboard
  - `/products/ram` - RAM
  - `/products/gpu` - Card đồ họa
  - `/products/storage` - Ổ cứng/SSD
  - `/products/psu` - Nguồn điện
  - `/products/case` - Vỏ máy
  - `/products/cooling` - Tản nhiệt
  - `/products/peripherals` - Phụ kiện (Bàn phím, chuột, màn hình)
  - `/products/prebuilt` - Máy tính có sẵn
  - `/products/laptops` - Laptop gaming

### 3. Chi Tiết Sản Phẩm (Product Detail)
- `/products/[slug]` - Chi tiết sản phẩm
  - Hình ảnh/Gallery (độ phân giải cao)
  - Video sản phẩm
  - Thông tin chi tiết
  - Thông số kỹ thuật
  - Giá và khuyến mãi
  - Sản phẩm liên quan (Gợi ý)
  - Đánh giá và nhận xét
  - Câu hỏi thường gặp về sản phẩm
  - Hỗ trợ tư vấn (Chat/Contact)

### 4. AuraLab - Build PC Cá Nhân Hóa (Advanced Feature)
- `/aura-lab` - Trang chủ AuraLab
  - `/aura-lab/builder` - Công cụ build PC
    - Chọn linh kiện từng loại
    - Kiểm tra tương thích
    - Xem tổng giá
    - Lưu build (cần đăng nhập)
  - `/aura-lab/saved-builds` - Builds đã lưu (cần đăng nhập)
  - `/aura-lab/presets` - Build mẫu
    - `/aura-lab/presets/gaming` - Build gaming
    - `/aura-lab/presets/workstation` - Build workstation
    - `/aura-lab/presets/budget` - Build giá rẻ

### 5. Tìm Kiếm & Lọc (Search & Filter)
- `/search` - Trang tìm kiếm
  - `/search?q=[keyword]` - Tìm kiếm cơ bản
  - `/search/advanced` - Tìm kiếm nâng cao
    - Lọc theo giá
    - Lọc theo thương hiệu
    - Lọc theo đánh giá
    - Lọc theo tính năng
    - Sắp xếp (Giá, Đánh giá, Mới nhất)

### 6. Giỏ Hàng & Thanh Toán (Cart & Checkout)
- `/cart` - Giỏ hàng
  - Xem sản phẩm trong giỏ
  - Cập nhật số lượng
  - Xóa sản phẩm
  - Mã giảm giá
- `/checkout` - Thanh toán
  - `/checkout/information` - Thông tin giao hàng
  - `/checkout/shipping` - Phương thức vận chuyển
  - `/checkout/payment` - Phương thức thanh toán
  - `/checkout/review` - Xem lại đơn hàng
  - `/checkout/success` - Xác nhận đơn hàng

### 7. Tài Khoản Người Dùng (User Account)
- `/account` - Trang tài khoản (cần đăng nhập)
  - `/account/dashboard` - Tổng quan
  - `/account/profile` - Thông tin cá nhân
  - `/account/orders` - Đơn hàng
    - `/account/orders/[orderId]` - Chi tiết đơn hàng
  - `/account/addresses` - Địa chỉ giao hàng
  - `/account/payment-methods` - Phương thức thanh toán
  - `/account/wishlist` - Sản phẩm yêu thích
  - `/account/reviews` - Đánh giá của tôi
  - `/account/settings` - Cài đặt tài khoản

### 8. Đăng Nhập/Đăng Ký (Authentication)
- `/login` - Đăng nhập
- `/register` - Đăng ký
- `/forgot-password` - Quên mật khẩu
- `/reset-password` - Đặt lại mật khẩu
- `/verify-email` - Xác thực email

### 9. Hỗ Trợ & Thông Tin (Support & Information)
- `/support` - Trang hỗ trợ
  - `/support/contact` - Liên hệ
  - `/support/faq` - Câu hỏi thường gặp
  - `/support/return-policy` - Chính sách đổi trả
  - `/support/warranty` - Bảo hành
  - `/support/shipping` - Vận chuyển
  - `/support/payment` - Thanh toán
  - `/support/live-chat` - Chat trực tuyến (Chatbot)

### 10. Tutorial & Hướng Dẫn (Advanced Feature)
- `/tutorials` - Trang tutorial
  - `/tutorials/getting-started` - Hướng dẫn sử dụng Web
  - `/tutorials/pc-knowledge` - Kiến thức PC
    - `/tutorials/pc-knowledge/cpu` - Kiến thức CPU
    - `/tutorials/pc-knowledge/gpu` - Kiến thức GPU
    - `/tutorials/pc-knowledge/motherboard` - Kiến thức Mainboard
    - `/tutorials/pc-knowledge/assembly` - Hướng dẫn lắp ráp
    - `/tutorials/pc-knowledge/troubleshooting` - Xử lý sự cố

### 11. Tin Tức & Blog (News & Blog)
- `/news` - Tin tức
  - `/news/[slug]` - Chi tiết tin tức
- `/blog` - Blog
  - `/blog/[slug]` - Chi tiết bài viết

### 12. Khuyến Mãi (Promotions)
- `/promotions` - Trang khuyến mãi
  - `/promotions/[slug]` - Chi tiết chương trình

### 13. Về Chúng Tôi (About)
- `/about` - Giới thiệu
- `/about/team` - Đội ngũ
- `/about/careers` - Tuyển dụng

### 14. Liên Kết Xã Hội (Social Media Integration)
- Các liên kết đến:
  - Facebook
  - Instagram
  - YouTube
  - TikTok
  - Zalo

---

## 👨‍💼 ADMIN SITE (Trang Quản Trị)

### 1. Dashboard (Trang Chủ Admin)
- `/admin` - Dashboard chính
  - Thống kê tổng quan
  - Đơn hàng mới
  - Doanh thu
  - Lượt truy cập
  - Sản phẩm bán chạy

### 2. Quản Lý Sản Phẩm (Product Management)
- `/admin/products` - Danh sách sản phẩm
  - `/admin/products/create` - Thêm sản phẩm mới
  - `/admin/products/[id]/edit` - Sửa sản phẩm
  - `/admin/products/[id]/delete` - Xóa sản phẩm
  - `/admin/products/categories` - Quản lý danh mục
    - `/admin/products/categories/create` - Thêm danh mục
    - `/admin/products/categories/[id]/edit` - Sửa danh mục
  - `/admin/products/attributes` - Quản lý thuộc tính
  - `/admin/products/inventory` - Quản lý tồn kho
  - `/admin/products/import` - Nhập hàng loạt
  - `/admin/products/export` - Xuất dữ liệu

### 3. Quản Lý Đơn Hàng (Order Management)
- `/admin/orders` - Danh sách đơn hàng
  - `/admin/orders/[id]` - Chi tiết đơn hàng
  - `/admin/orders/[id]/edit` - Sửa đơn hàng
  - `/admin/orders/[id]/status` - Cập nhật trạng thái
  - `/admin/orders/refunds` - Hoàn tiền

### 4. Quản Lý Người Dùng (User Management)
- `/admin/users` - Danh sách người dùng
  - `/admin/users/create` - Tạo tài khoản mới
  - `/admin/users/[id]` - Chi tiết người dùng
  - `/admin/users/[id]/edit` - Sửa thông tin
  - `/admin/users/[id]/delete` - Xóa người dùng
  - `/admin/users/[id]/activity` - Lịch sử hoạt động
- `/admin/users/roles` - Quản lý vai trò
  - `/admin/users/roles/create` - Tạo vai trò mới
  - `/admin/users/roles/[id]/edit` - Sửa vai trò
  - `/admin/users/roles/[id]/permissions` - Phân quyền

### 5. Quản Lý Nội Dung (Content Management)
- `/admin/content` - Trang quản lý nội dung
  - `/admin/content/pages` - Quản lý trang
    - `/admin/content/pages/create` - Tạo trang mới
    - `/admin/content/pages/[id]/edit` - Sửa trang
  - `/admin/content/posts` - Quản lý bài viết/Tin tức
    - `/admin/content/posts/create` - Tạo bài viết mới
    - `/admin/content/posts/[id]/edit` - Sửa bài viết
  - `/admin/content/tutorials` - Quản lý Tutorial
    - `/admin/content/tutorials/create` - Tạo tutorial mới
    - `/admin/content/tutorials/[id]/edit` - Sửa tutorial
  - `/admin/content/media` - Quản lý Media (File Manager)
    - Upload hình ảnh
    - Upload video
    - Upload tài liệu
    - Quản lý thư viện
  - `/admin/content/seo` - Quản lý SEO
    - Meta tags
    - Sitemap
    - Robots.txt

### 6. Quản Lý Tương Tác (Interaction Management)
- `/admin/interactions` - Trang quản lý tương tác
  - `/admin/interactions/comments` - Quản lý bình luận
    - Duyệt/Xóa bình luận
    - Trả lời bình luận
  - `/admin/interactions/reviews` - Quản lý đánh giá
    - Duyệt/Xóa đánh giá
    - Phản hồi đánh giá
  - `/admin/interactions/messages` - Quản lý tin nhắn
    - `/admin/interactions/messages/[id]` - Chi tiết tin nhắn
    - Trả lời tin nhắn
  - `/admin/interactions/contacts` - Quản lý liên hệ
    - `/admin/interactions/contacts/[id]` - Chi tiết liên hệ

### 7. Quản Lý Khuyến Mãi (Promotion Management)
- `/admin/promotions` - Quản lý khuyến mãi
  - `/admin/promotions/create` - Tạo chương trình khuyến mãi
  - `/admin/promotions/[id]/edit` - Sửa khuyến mãi
  - `/admin/promotions/coupons` - Quản lý mã giảm giá
    - `/admin/promotions/coupons/create` - Tạo mã giảm giá
    - `/admin/promotions/coupons/[id]/edit` - Sửa mã giảm giá

### 8. Quản Lý Giao Diện (Appearance/Theme Management)
- `/admin/appearance` - Trang quản lý giao diện
  - `/admin/appearance/themes` - Quản lý theme
    - Cài đặt theme
    - Tùy chỉnh theme
  - `/admin/appearance/customize` - Tùy chỉnh giao diện
    - Logo
    - Màu sắc
    - Font chữ
    - Layout
  - `/admin/appearance/widgets` - Quản lý Widget
    - Thêm/Xóa/Sửa widget
    - Sắp xếp vị trí
  - `/admin/appearance/menus` - Quản lý Menu
    - Tạo/Sửa/Xóa menu
    - Sắp xếp menu items

### 9. Quản Lý Hệ Thống & Bảo Mật (System & Security)
- `/admin/settings` - Cài đặt hệ thống
  - `/admin/settings/general` - Cài đặt chung
    - Tên website
    - Logo
    - Thông tin liên hệ
    - Địa chỉ
    - Email
    - Số điện thoại
  - `/admin/settings/payment` - Cài đặt thanh toán
    - Cổng thanh toán
    - Cấu hình thanh toán
  - `/admin/settings/shipping` - Cài đặt vận chuyển
    - Phương thức vận chuyển
    - Phí vận chuyển
    - Vùng giao hàng
  - `/admin/settings/email` - Cài đặt email
    - SMTP settings
    - Email templates
  - `/admin/settings/security` - Bảo mật
    - Đổi mật khẩu admin
    - Two-factor authentication
    - IP whitelist/blacklist
    - API keys
  - `/admin/settings/backup` - Sao lưu
    - Tạo backup
    - Khôi phục backup
    - Lịch sử backup

### 10. Thống Kê & Báo Cáo (Analytics & Reports)
- `/admin/analytics` - Thống kê
  - `/admin/analytics/overview` - Tổng quan
  - `/admin/analytics/sales` - Doanh thu
    - Báo cáo theo ngày/tuần/tháng/năm
    - Báo cáo theo sản phẩm
    - Báo cáo theo danh mục
  - `/admin/analytics/visitors` - Lượt truy cập
    - Số lượng visitor
    - Trang phổ biến
    - Nguồn traffic
  - `/admin/analytics/users` - Thống kê người dùng
    - Người dùng mới
    - Hoạt động người dùng
  - `/admin/analytics/export` - Xuất báo cáo

### 11. Quản Lý AuraLab (AuraLab Management)
- `/admin/aura-lab` - Quản lý AuraLab
  - `/admin/aura-lab/presets` - Quản lý build mẫu
    - `/admin/aura-lab/presets/create` - Tạo build mẫu
    - `/admin/aura-lab/presets/[id]/edit` - Sửa build mẫu
  - `/admin/aura-lab/compatibility` - Quản lý tương thích
    - Rules tương thích
    - Cấu hình compatibility checker

### 12. Quản Lý Chatbot (Chatbot Management)
- `/admin/chatbot` - Quản lý Chatbot
  - `/admin/chatbot/settings` - Cài đặt chatbot
  - `/admin/chatbot/responses` - Quản lý câu trả lời
    - Tạo/Sửa/Xóa responses
  - `/admin/chatbot/logs` - Lịch sử chat
  - `/admin/chatbot/training` - Training AI

### 13. Quản Lý Tài Khoản Admin (Admin Account)
- `/admin/account` - Tài khoản admin
  - `/admin/account/profile` - Thông tin cá nhân
  - `/admin/account/password` - Đổi mật khẩu
  - `/admin/account/security` - Bảo mật
  - `/admin/logout` - Đăng xuất

### 14. API & Webhooks
- `/admin/api` - Quản lý API
  - `/admin/api/keys` - API Keys
  - `/admin/api/webhooks` - Webhooks
  - `/admin/api/logs` - API Logs

---

## 📊 Sơ Đồ Cấu Trúc Tổng Quan

```
AuraPC Website
│
├── Client Site (/)
│   ├── Homepage
│   ├── Products
│   │   ├── Categories
│   │   └── Product Detail
│   ├── AuraLab (PC Builder)
│   ├── Search & Filter
│   ├── Cart & Checkout
│   ├── User Account
│   ├── Authentication
│   ├── Support & Information
│   ├── Tutorials
│   ├── News/Blog
│   └── Promotions
│
└── Admin Site (/admin)
    ├── Dashboard
    ├── Products Management
    ├── Orders Management
    ├── Users Management
    ├── Content Management
    ├── Interactions Management
    ├── Promotions Management
    ├── Appearance Management
    ├── System & Security
    ├── Analytics & Reports
    ├── AuraLab Management
    ├── Chatbot Management
    └── Admin Account
```

---

## 🔑 Key Features Mapping

### Basic Features → Pages
1. **Hiển thị sản phẩm** → `/products`, `/products/[slug]`
2. **Gợi ý sản phẩm** → `/products/[slug]` (Related Products section)
3. **Thanh toán & Vận chuyển** → `/checkout`
4. **Đánh giá sản phẩm** → `/products/[slug]` (Reviews section)
5. **FAQ** → `/support/faq`
6. **Hỗ trợ & Liên hệ** → `/support/contact`
7. **Chính sách đổi trả** → `/support/return-policy`

### Advanced Features → Pages
1. **Tutorial** → `/tutorials`
2. **Tìm kiếm nâng cao** → `/search/advanced`
3. **Giỏ hàng & Yêu thích** → `/cart`, `/account/wishlist`
4. **Mobile-friendly** → Responsive design cho tất cả pages
5. **Social Media** → Integration trong footer/header
6. **AuraLab** → `/aura-lab`
7. **Chatbot** → `/support/live-chat`, Widget floating

---

## 📝 Notes

- Tất cả các trang cần responsive design cho mobile
- SEO optimization cho tất cả trang public
- Breadcrumb navigation cho các trang con
- Loading states và error handling
- Accessibility (a11y) compliance
- Multi-language support (nếu cần)
- Dark mode support (tùy chọn)
