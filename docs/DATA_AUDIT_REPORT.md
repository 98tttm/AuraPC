# Báo cáo kiểm duyệt Data AuraPC

Đối chiếu data hiện tại với promptdata.md và yêu cầu giao diện (api.service.ts).

---

## 1. Tổng quan so sánh

| Entity | Promptdata | Data hiện có | Frontend API cần | Thiếu |
|--------|------------|--------------|------------------|-------|
| **Categories** | 7 Lv1, hierarchy 4 cấp | 142 categories ✅ | category_id, name, slug, parent_id, level | — |
| **Products** | product_id, name, price, images, specs, description | Có nhưng thiếu vài field | brand, shortDescription | brand, shortDescription |
| **Blogs** | 100 bài, lọc HTML | Có | coverImage, author | coverImage, author |

---

## 2. Products – Data thiếu

### 2.1. So với Frontend (`api.service.ts` Product interface)

| Field | Frontend cần | Data hiện có | Ghi chú |
|-------|--------------|--------------|---------|
| `brand` | ✅ | ❌ Thiếu | Filter theo hãng, hiển thị logo |
| `shortDescription` | ✅ | ❌ Thiếu | Mô tả ngắn cho card sản phẩm |
| `description` | Optional | ❌ | Có `description_html` – có thể dùng hoặc strip HTML |
| `category` | Object `{ _id, category_id, name, slug }` | Chỉ có `category_id`, `category_ids` | Frontend có thể tự join từ categories |
| `techSpecs` | Optional | ❌ | Có `specs` – tương đương |

### 2.2. Có thể lấy từ Haravan API

- **brand**: Haravan Product có `vendor` (nếu Xgear/GearVN điền)
- **shortDescription**: Strip HTML từ `body_html` → 150–200 ký tự, hoặc field `body` có sẵn

### 2.3. Đề xuất bổ sung vào scraper

```python
# Trong transform_product(), thêm:
"brand": p.get("vendor") or (specs.get("Hãng sản xuất") if specs else None) or "",
"shortDescription": (BeautifulSoup(body_html, "lxml").get_text(strip=True)[:300] if body_html else "") or "",
```

---

## 3. Blogs – Data thiếu

### 3.1. So với Frontend (`BlogPost` interface)

| Field | Frontend cần | Data hiện có | Ghi chú |
|-------|--------------|--------------|---------|
| `coverImage` | ✅ | ❌ Thiếu | Ảnh đại diện cho list/card |
| `author` | ✅ | ❌ Thiếu | Tác giả bài viết |

### 3.2. Cách lấy

- **coverImage**: Parse HTML, lấy thẻ `<img>` đầu tiên trong `content`, hoặc thumbnail từ Xgear blog listing
- **author**: Thường nằm trong `content` (VD: "Bích Ngân") – cần parse từ HTML hoặc meta

### 3.3. Đề xuất bổ sung vào scraper

```python
# Trong _parse_blog_article():
cover_img = soup.select_one("article img, .article-body img, main img")
coverImage = cover_img.get("src") if cover_img else ""
# Author: thường trong .date-time hoặc span sau ngày
author_el = soup.select_one(".author, .article__author, [style*='color: blue']")
author = author_el.get_text(strip=True) if author_el else ""
```

---

## 4. Categories – Đã đủ

- 7 Lv1, hierarchy 4 cấp
- `category_id` = slug
- Có `source_url`, `source` (có thể ẩn khi hiển thị)

**Lưu ý**: Frontend có thể cần thêm `source_url` nếu có link “Xem tại Xgear/GearVN”. Theo DATA_STRUCTURE_FOR_UI.md mới: ẩn `source` và `url`.

---

## 5. Các field khác có thể hữu ích

| Field | Entity | Mục đích |
|-------|--------|----------|
| `available` | Product | Hiển thị “Hết hàng”, ẩn nút mua |
| `discountPercent` | Product | Có thể tính từ `(old_price - price) / old_price * 100` |
| `mainImage` | Product | = `images[0]` – tiện cho UI |
| `createdAt`, `updatedAt` | Product/Blog | Sắp xếp, filter theo ngày |

---

## 6. Hành động đề xuất

### Mức ưu tiên 1 (Cần cho UI)

1. **Product.brand** – Thêm vào scraper (từ `vendor` hoặc `specs["Hãng sản xuất"]`)
2. **Product.shortDescription** – Strip HTML `body_html` → 200 ký tự
3. **Blog.coverImage** – Lấy img đầu tiên từ content
4. **Blog.author** – Parse từ HTML

### Mức ưu tiên 2 (Tùy chọn)

5. **Product.available** – Nếu Haravan có `inventory_quantity` / `available`
6. **Product.mainImage** – Alias của `images[0]` để tiện dùng

### Mức ưu tiên 3 (Backend/Frontend xử lý)

7. **discountPercent** – Tính từ price/old_price phía client
8. **category object** – Frontend join `category_ids` với `categories`

---

## 7. Cập nhật DATA_STRUCTURE_FOR_UI.md

Sẽ bổ sung schema đầy đủ bao gồm các field mới và ghi chú field nào cần cập nhật scraper.
