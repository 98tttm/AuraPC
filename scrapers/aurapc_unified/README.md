# AuraPC Unified Scraper

Thống nhất data theo `data/promptdata.md`: 7 danh mục lớn, hierarchy 4 cấp, cào Xgear + GearVN → MongoDB Atlas.

## Cài đặt

```bash
pip install -r requirements.txt
```

## Chạy

```bash
# Cào đầy đủ và đẩy lên MongoDB
python unified_scraper.py

# Chỉ xuất file JSON, không đẩy MongoDB
python unified_scraper.py --no-mongo

# Bỏ qua products hoặc blogs
python unified_scraper.py --skip-products
python unified_scraper.py --skip-blogs

# Giới hạn sản phẩm/danh mục (mặc định 50)
python unified_scraper.py --product-limit 30

# Không xóa data cũ khi insert MongoDB
python unified_scraper.py --no-clear
```

## Output

- `data/categories.json` – Danh mục (category_id = slug, parent_id, level)
- `data/products.ndjson` – Sản phẩm (max 50/danh mục)
- `data/blogs.ndjson` – 100 bài tin mới nhất

MongoDB: collections `categories`, `products`, `blogs`.

## Clean & Import từ file có sẵn

Nếu đã có data trong `data/`, dùng script import (tự động clean trước khi push):

```bash
# Import từ d:\AuraPC\data
python import_to_mongo.py --data-dir "d:\AuraPC\data"

# Hoặc từ thư mục mặc định ../../data
python import_to_mongo.py
```

Clean logic: thêm `slug` (từ handle), deduplicate products theo (source, product_id), gộp `category_ids`, đảm bảo slug unique cho blogs.
