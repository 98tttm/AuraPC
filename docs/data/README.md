# Dữ liệu và báo cáo danh mục (cấu trúc chặt chẽ)

## Một lệnh xử lý toàn bộ (khuyến nghị)

Từ thư mục **server** (có `.env` với `MONGODB_URI`):

```bash
cd server
node scripts/build-strict-category-report.js
```

Script sẽ:

1. Đọc toàn bộ **categories** và **products** từ MongoDB.
2. Chuẩn hóa theo schema cố định (id string, level, parent_id, display_order).
3. Build cây danh mục chặt chẽ (parent chỉ trỏ tới node tồn tại, sắp theo level + display_order).
4. Gán sản phẩm vào đúng danh mục (khớp `category` / `category_id` / `categoryId` với `id` danh mục).
5. Ghi ra:
   - **`docs/data/structured-categories-and-products.json`** — JSON chuẩn (meta, categoriesTree, categoriesFlat, unassignedProducts).
   - **`docs/BAO_CAO_DANH_MUC.md`** — báo cáo danh mục (tổng quan + cây + bảng phẳng).
   - **`docs/BAO_CAO_SAN_PHAM_THEO_DANH_MUC.md`** — sản phẩm theo từng danh mục (theo level).

Cấu trúc JSON được mô tả trong **`docs/data/SCHEMA_STRUCTURE.md`**.

---

## Script từng bước (tùy chọn)

- **`export-and-report-categories.js`** — chỉ export danh mục → `categories-data.json` + `BAO_CAO_DANH_MUC.md`.
- **`assign-products-by-category.js`** — cần có `categories-data.json` trước; gán sản phẩm → `products-by-category.json` + `BAO_CAO_SAN_PHAM_THEO_DANH_MUC.md`.
