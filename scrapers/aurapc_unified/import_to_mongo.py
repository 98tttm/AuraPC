#!/usr/bin/env python3
"""
Import data từ file JSON/NDJSON đã cào -> Clean -> Push MongoDB.
Dùng khi có sẵn data/*.json và muốn đẩy lên MongoDB mà không cào lại.
"""
import argparse
import json
import sys
from pathlib import Path

# Add parent for imports
sys.path.insert(0, str(Path(__file__).parent))
from unified_scraper import (
    clean_categories_for_mongo,
    clean_products_for_mongo,
    clean_blogs_for_mongo,
    push_to_mongo,
)


def load_data(data_dir: Path):
    """Đọc categories, products, blogs từ thư mục data."""
    categories = []
    if (data_dir / "categories.json").exists():
        with open(data_dir / "categories.json", encoding="utf-8") as f:
            categories = json.load(f)

    products = []
    if (data_dir / "products.ndjson").exists():
        with open(data_dir / "products.ndjson", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    products.append(json.loads(line))

    blogs = []
    if (data_dir / "blogs.ndjson").exists():
        with open(data_dir / "blogs.ndjson", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    blogs.append(json.loads(line))

    return categories, products, blogs


def main():
    parser = argparse.ArgumentParser(description="Import data đã clean vào MongoDB")
    parser.add_argument("--data-dir", default="../../data", help="Thư mục chứa categories.json, products.ndjson, blogs.ndjson")
    parser.add_argument("--no-clear", action="store_true", help="Không xóa data cũ trước khi insert")
    args = parser.parse_args()

    data_dir = Path(args.data_dir).resolve()
    if not data_dir.exists():
        print(f"[ERROR] Thư mục không tồn tại: {data_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"[INFO] Đọc từ {data_dir}...", file=sys.stderr)
    categories, products, blogs = load_data(data_dir)
    print(f"[INFO] Loaded: {len(categories)} categories, {len(products)} products, {len(blogs)} blogs", file=sys.stderr)

    print("[INFO] Cleaning...", file=sys.stderr)
    categories = clean_categories_for_mongo(categories)
    products = clean_products_for_mongo(products)
    blogs = clean_blogs_for_mongo(blogs)
    print(f"[INFO] Sau clean: {len(products)} products (deduplicated)", file=sys.stderr)

    print("[INFO] Pushing to MongoDB...", file=sys.stderr)
    push_to_mongo(categories, products, blogs, clear_first=not args.no_clear)
    print("[DONE]", file=sys.stderr)


if __name__ == "__main__":
    main()
