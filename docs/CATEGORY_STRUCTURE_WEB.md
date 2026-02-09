# Cấu trúc danh mục khi đưa lên web (AuraPC)

## 1. Dữ liệu từ MongoDB

- **Category**: `name`, `slug`, `parent` (ObjectId hoặc null), `order`, `active`.
- **Product**: có trường `category` (ObjectId tham chiếu Category).
- Danh mục có thể **phẳng** (mọi category cùng cấp) hoặc **cây** (dùng `parent` cho danh mục con).

---

## 2. Cách lấy báo cáo danh mục

### Option A: Gọi API (khi server đang chạy)

```http
GET /api/categories/report
```

Trả về:

```json
{
  "summary": {
    "totalCategories": 10,
    "totalProducts": 150,
    "productsWithoutCategory": 2
  },
  "categories": [
    {
      "_id": "...",
      "name": "Laptop",
      "slug": "laptop",
      "parent": null,
      "order": 0,
      "active": true,
      "productCount": 25
    }
  ]
}
```

### Option B: Chạy script local (test nhanh, không cần bật server)

Từ thư mục `server`, có file `.env` với `MONGODB_URI`:

```bash
cd server
node scripts/category-report.js
```

Script in ra console: tổng số danh mục, tổng sản phẩm, và từng danh mục kèm số sản phẩm.

---

## 3. Nên chia cấu trúc thế nào khi đưa lên web

### 3.1. Danh mục phẳng (flat) – đơn giản

- Mọi category cùng một cấp (`parent = null`).
- **Trên web**: một menu/ dropdown liệt kê tất cả danh mục.
- **URL**: `/san-pham?category=laptop` hoặc `/danh-muc/laptop`.
- **Sắp xếp**: dùng trường `order` (số nhỏ hiện trước), sau đó `name`.
- Phù hợp khi ít danh mục (khoảng vài chục).

### 3.2. Danh mục cây (nhiều cấp) – có parent

- Category có `parent` trỏ tới category cha.
- **Trên web**: menu đa cấp (dropdown có cấp con), hoặc sidebar “Danh mục” dạng cây.
- **URL** có thể:
  - Chỉ dùng slug danh mục lá: `/danh-muc/laptop-gaming` (đủ unique).
  - Hoặc path đầy đủ: `/danh-muc/may-tinh/laptop/laptop-gaming` (nếu cần rõ cấp).
- **Sắp xếp**: mỗi cấp sort theo `order` rồi `name`; hiển thị con nằm dưới cha.
- Phù hợp khi nhiều danh mục, cần nhóm (VD: Máy tính → Laptop → Laptop gaming).

### 3.3. Gợi ý cho AuraPC

| Nội dung | Gợi ý |
|----------|--------|
| **API hiện tại** | `GET /api/categories` trả về danh mục active, đã sort `order`, `name`. Dùng cho menu/ filter. |
| **Báo cáo** | Dùng `GET /api/categories/report` hoặc script `category-report.js` để kiểm tra data (số SP từng danh mục, danh mục không dùng, v.v.). |
| **URL trên web** | Nên dùng slug: `/san-pham` (list) và `/san-pham?category=laptop` hoặc `/danh-muc/laptop` (lọc theo category). |
| **Cấu trúc** | Nếu ít danh mục: giữ phẳng. Nếu sau này nhiều: dùng `parent` và build cây từ `categories` (nhóm theo `parent`) để render menu/ sidebar. |
| **Sản phẩm không có category** | Trong report có `productsWithoutCategory`. Nên gán category hoặc tạo danh mục “Chưa phân loại” rồi gán vào. |

---

## 4. Luồng dữ liệu gợi ý trên web

1. **Trang load**: gọi `GET /api/categories` → lấy danh mục active.
2. **Menu / Sidebar**: render danh mục (phẳng: một list; cây: build tree từ `parent`).
3. **Trang sản phẩm**: gọi `GET /api/products?category=<id hoặc slug>` (backend cần hỗ trợ filter theo slug nếu dùng slug trong URL).
4. **Kiểm tra data**: định kỳ gọi `GET /api/categories/report` hoặc chạy `node scripts/category-report.js` để xem tổng quan danh mục và số sản phẩm.

Nếu bạn gửi thêm ví dụ vài category thật trong MongoDB, có thể đề xuất chi tiết hơn (VD: cấu trúc menu, route từng trang).
