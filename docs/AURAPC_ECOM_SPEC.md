# AuraPC E-Commerce — Spec & Progress (Trí nhớ dự án)

> **Mục đích:** Lưu scope, sitemap, cấu trúc dữ liệu, tiến độ và task để mỗi phiên (hoặc khi hết context) có thể tiếp tục mà không mất thông tin.

---

## 1. Tổng quan

- **Dự án:** Website thương mại điện tử AuraPC (client + admin).
- **Chạy local trước,** chưa push repo.
- **Database:** MongoDB (Atlas) — database `AuraPC`, collections: `products`, `categories`, `blogs`.
- **Figma:** WEB2 — MAIN  
  - Client: `https://www.figma.com/design/QJd3hS6b7p8Zffe3uqrlcR/WEB2---MAIN?node-id=0-1` (node `0:1`)  
  - Khác: `node-id=8-139` (node `8:139`)  
  - Admin: chưa design xong trong Figma — tinh chỉnh giao diện cho phù hợp dự án.
- **Tham khảo:** [GEARVN](https://gearvn.com/), [Corsair](https://www.corsair.com/us/en).

---

## 2. Tech stack hiện tại

| Phần | Công nghệ |
|------|-----------|
| Client | Angular (my-client), đã có homepage 3D, header, footer |
| Admin | Angular (my-admin), cấu trúc tối thiểu |
| Server | Node.js, Express, Mongoose (server/), đã có `connectDB()` |
| DB | MongoDB — `MONGODB_URI` trong `.env` |

---

## 3. Sitemap (theo `markdow_infor/AuraPC_Sitemap.md`)

### Client (ưu tiên làm trước)
- `/` — Trang chủ (đã có, bổ sung block sản phẩm nổi bật, danh mục, tin tức)
- `/products` — Danh sách sản phẩm (lọc theo category)
- `/products/[slug]` — Chi tiết sản phẩm
- `/cart` — Giỏ hàng
- `/checkout` — Thanh toán (information → shipping → payment → review → success)
- `/login`, `/register` — Auth
- `/blog`, `/blog/[slug]` — Blog
- `/news`, `/news/[slug]` — Tin tức (hoặc gộp với blog)
- `/support/contact`, `/support/faq`, … — Hỗ trợ
- Footer: thông tin đầy đủ (liên hệ, chính sách, mạng xã hội)

### Admin (CRUD + dashboard)
- `/admin` — Dashboard
- `/admin/products` — Danh sách, thêm/sửa/xóa sản phẩm
- `/admin/categories` — Quản lý danh mục
- `/admin/content/posts` — Quản lý bài viết (blog/tin tức)
- `/admin/orders` — Đơn hàng (khi có flow thanh toán)

---

## 4. Cấu trúc dữ liệu MongoDB (đề xuất)

### Collection `products`
```js
{
  _id: ObjectId,
  name: String,
  slug: String,           // unique, for URL
  description: String,
  shortDescription: String,
  price: Number,
  salePrice: Number,      // optional
  category: ObjectId,     // ref categories
  images: [{ url: String, alt: String }],
  specs: {},              // key-value thông số
  stock: Number,
  featured: Boolean,
  active: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Collection `categories`
```js
{
  _id: ObjectId,
  name: String,
  slug: String,
  parent: ObjectId | null,
  order: Number,
  active: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Collection `blogs`
```js
{
  _id: ObjectId,
  title: String,
  slug: String,
  excerpt: String,
  content: String,
  coverImage: String,
  author: String,
  published: Boolean,
  publishedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Collection `orders` (tạo khi làm checkout)
```js
{
  _id: ObjectId,
  orderNumber: String,
  user: ObjectId | null,
  items: [{ product: ObjectId, qty: Number, price: Number }],
  shippingAddress: {},
  status: String,
  total: Number,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 5. API Server (cần implement)

- `GET /api/products` — list (query: category, search, page, limit)
- `GET /api/products/:slug` — chi tiết
- `GET /api/categories` — danh mục (tree hoặc flat)
- `GET /api/blogs` — list bài viết
- `GET /api/blogs/:slug` — chi tiết bài viết
- Admin (CRUD): `POST/PUT/DELETE /api/admin/products`, categories, blogs (có auth sau).

---

## 6. Figma

- **File:** `QJd3hS6b7p8Zffe3uqrlcR` (WEB2 — MAIN).
- **Nodes:** `0:1` (trang/frame chính), `8:139` (frame khác).
- Khi implement từng trang: gọi `get_design_context` với `fileKey` + `nodeId` tương ứng để lấy layout/UI.
- Responsive: desktop + mobile theo Figma; chỉnh bố cục/kích thước cho đúng.

---

## 7. Tiến độ & Task (cập nhật khi làm)

### Phase 1 — Nền tảng
- [ ] Tạo file spec này và cấu trúc docs
- [ ] Server: API products, categories, blogs (GET); model Mongoose
- [ ] Client: service gọi API, env base URL
- [ ] Cấu trúc routes client (products, cart, checkout, blog, …)

### Phase 2 — Client core
- [ ] Trang chủ: bổ sung block sản phẩm nổi bật, danh mục (từ Figma 0:1)
- [ ] Danh sách sản phẩm `/products`, lọc theo category
- [ ] Chi tiết sản phẩm `/products/:slug`
- [ ] Giỏ hàng (state + trang `/cart`)
- [ ] Checkout (các bước: information → payment/review → success)
- [ ] Footer đầy đủ thông tin
- [ ] Login/Register (form + API)

### Phase 3 — Admin
- [ ] Dashboard `/admin`
- [ ] CRUD Products (list, create, edit)
- [ ] CRUD Categories
- [ ] CRUD Blog/Posts
- [ ] Giao diện admin phù hợp dự án (Figma chưa đủ thì tự chỉnh)

### Phase 4 — Tinh chỉnh
- [ ] Lấy design Figma từng trang, chỉnh desktop + mobile
- [ ] Button chức năng đầy đủ, link đúng sitemap
- [ ] SEO, error handling, loading states

---

## 8. Ghi chú handoff

- **Repo:** `d:\AuraPC` — client `projects/my-client`, admin `projects/my-admin`, server `server/`.
- **MongoDB:** Biến môi trường `MONGODB_URI` trong `server/.env` (không commit .env).
- **Quy tắc:** Làm theo SDD/rule trong `.cursor/rules`, dùng skill (create-rule, create-skill) khi cần.
- **Nhớ:** Mỗi lần hoàn thành task, cập nhật section 7 (checkbox) và ghi rõ file/route đã tạo/sửa.
