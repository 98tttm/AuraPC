# Cấu trúc Data AuraPC – Đặc tả cho hiển thị giao diện

Tài liệu này mô tả cấu trúc data thống nhất dùng để hiển thị sản phẩm, danh mục và tin tức trên giao diện AuraPC.

---

## 1. Tổng quan

| Entity | Số lượng | Nguồn | Format |
|--------|----------|-------|--------|
| **Categories** | 142 | Xgear + GearVN | JSON array |
| **Products** | ~1643 (unique) | Xgear + GearVN | NDJSON (mỗi dòng 1 object) |
| **Blogs** | 100 | Xgear | NDJSON |

- **Source**: `xgear` (xgear.net) hoặc `gearvn` (gearvn.com)
- **Danh mục Lv1**: Laptop, PC, Màn hình, Linh Kiện, Gaming Gear, Phụ Kiện, Bàn - Ghế

---

## 2. Categories (Danh mục)

### Schema

```typescript
interface Category {
  category_id: string;   // slug, dùng làm ID (VD: "laptop", "laptop-msi")
  parent_id: string | null;  // null = Lv1
  level: 1 | 2 | 3 | 4;     // cấp độ
  name: string;              // tên hiển thị
  slug: string;              // = category_id
  source_url: string;        // URL collection gốc
  source: "xgear" | "gearvn";
}
```

### Hierarchy

- **Level 1**: Danh mục lớn (Laptop, PC, Màn hình, Linh Kiện, Gaming Gear, Phụ Kiện, Bàn - Ghế)
- **Level 2–4**: Danh mục con (VD: laptop → laptop-msi → laptop-gaming-msi-creator)

### Quan hệ

- `parent_id = null` → danh mục gốc
- `parent_id = "laptop"` → danh mục con của Laptop

### Ví dụ

```json
{
  "category_id": "laptop-msi",
  "parent_id": "laptop",
  "level": 2,
  "name": "MSI",
  "slug": "laptop-msi",
  "source_url": "https://xgear.net/collections/laptop-msi",
  "source": "xgear"
}
```

### Gợi ý hiển thị UI

- **Menu/ sidebar**: Dựng cây từ `parent_id` (level 1 → 2 → 3 → 4)
- **URL**: `/category/{category_id}` hoặc `/category/{slug}`
- **Filter**: Lấy products có `category_id` hoặc `category_ids` chứa `category_id`

---

## 3. Products (Sản phẩm)

### Schema

```typescript
interface Product {
  product_id: string;        // ID từ nguồn (Haravan)
  handle: string;            // handle URL
  slug: string;              // unique, dùng cho URL chi tiết
  name: string;              // tên sản phẩm
  brand: string;             // hãng sản xuất (từ vendor/specs) – CẦN BỔ SUNG
  shortDescription: string;  // mô tả ngắn (~200 ký tự) – CẦN BỔ SUNG
  price: number;             // giá bán (VNĐ)
  old_price: number | null;  // giá gốc (nếu giảm)
  images: string[];          // danh sách URL ảnh
  mainImage?: string;        // = images[0], tiện cho UI
  category_id: string;       // danh mục chính (để tương thích)
  category_ids: string[];    // tất cả danh mục sản phẩm thuộc về
  specs: Record<string, string>;  // thông số kỹ thuật { key: value }
  description_html: string;  // mô tả HTML
  source: "xgear" | "gearvn";
  url: string;               // link gốc tới sản phẩm
}
```

### Fields quan trọng

| Field | Mục đích |
|-------|----------|
| `slug` | Unique, dùng cho `/product/{slug}` |
| `images[0]` | Ảnh chính |
| `price`, `old_price` | Giá, tính % giảm: `((old_price - price) / old_price) * 100` |
| `category_ids` | Filter theo danh mục, breadcrumb |
| `specs` | Bảng thông số chi tiết |

### Ví dụ

```json
{
  "product_id": "1073089777",
  "handle": "laptop-gaming-acer-nitro-v-15-propanel-anv15-52-59rr",
  "slug": "laptop-gaming-acer-nitro-v-15-propanel-anv15-52-59rr",
  "name": "Laptop Gaming Acer Nitro V 15 ProPanel...",
  "price": 0,
  "old_price": null,
  "images": ["https://cdn.hstatic.net/.../image1.png", "..."],
  "category_id": "laptop",
  "category_ids": ["laptop", "laptop-acer", "nitro-5", "laptop-gaming-ai"],
  "specs": {
    "CPU": "Intel Core 5 210H",
    "RAM": "16GB DDR4",
    "Card đồ họa": "RTX 5050 8GB"
  },
  "description_html": "<html>...</html>",
  "source": "xgear",
  "url": "https://xgear.net/products/laptop-gaming-acer-nitro-v-15-propanel-anv15-52-59rr"
}
```

### Gợi ý hiển thị UI

- **Danh sách sản phẩm**: Card với ảnh (`images[0]`), tên, giá, % giảm
- **Chi tiết sản phẩm**: Galley ảnh, mô tả, bảng specs từ `specs`
- **Filter theo danh mục**: `products.filter(p => p.category_ids.includes(categoryId))`
- **Định dạng giá**: Format VNĐ (VD: 30.990.000₫)

---

## 4. Blogs (Tin tức)

### Schema

```typescript
interface Blog {
  handle: string;       // handle URL
  title: string;        // tiêu đề
  slug: string;         // unique, cho URL
  excerpt: string;      // mô tả ngắn (~400 ký tự)
  content: string;      // nội dung HTML
  coverImage: string;   // ảnh đại diện – CẦN BỔ SUNG
  author: string;       // tác giả – CẦN BỔ SUNG
  category: string;     // blog category (VD: "huong-dan-thu-thuat")
  publishedAt: string;  // ngày đăng (VD: "09/02/2026")
  url: string;          // link gốc
  source: "xgear";
}
```

### Gợi ý hiển thị UI

- **Danh sách tin**: Card với title, excerpt, publishedAt
- **Chi tiết**: Render `content` (HTML) với sanitize
- **URL**: `/blog/{slug}` hoặc `/tin-tuc/{slug}`

---

## 5. Quan hệ giữa các Entity

```
Category (category_id)
    ↑
    │ category_ids chứa category_id
    │
Product ──── slug ────► URL chi tiết: /product/{slug}
    │
    └── category_id / category_ids ────► Filter, breadcrumb

Blog ──── slug ────► URL: /blog/{slug}
```

---

## 6. API / Data flow gợi ý

### Backend (MongoDB collections)

- `categories` – toàn bộ danh mục
- `products` – sản phẩm đã dedupe
- `blogs` – bài viết

### Query gợi ý

1. **Lấy danh mục con của Lv1**:
   ```js
   categories.find({ parent_id: "laptop" })
   ```

2. **Lấy sản phẩm theo danh mục**:
   ```js
   products.find({ category_ids: "laptop-msi" })
   ```

3. **Lấy chi tiết sản phẩm**:
   ```js
   products.findOne({ slug: "laptop-gaming-acer-nitro-v-15-propanel-anv15-52-59rr" })
   ```

4. **Lấy danh mục gốc (Lv1)**:
   ```js
   categories.find({ level: 1 })
   ```

---

## 7. Lưu ý khi hiển thị

- **Ảnh**: Dùng URL từ `images[]`
- **Giá = 0**: Ẩn giá hoặc hiển thị “Liên hệ”
- **description_html**: Render HTML có sanitize (VD: DOMPurify)
- **source**: Không hiển thị badge “Xgear” / “GearVN” và không link `url` ra site gốc(ẩn dữ liệu này hết)
---
- **Chi tiết field thiếu**: Xem `docs/DATA_AUDIT_REPORT.md`
