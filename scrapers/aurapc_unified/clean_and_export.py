#!/usr/bin/env python3
"""
Clean data từ file có sẵn -> Ghi lại file đã clean.
Dùng khi muốn import qua MongoDB Compass: file output sẵn slug, deduplicated.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from unified_scraper import (
    clean_categories_for_mongo,
    clean_products_for_mongo,
    clean_blogs_for_mongo,
)


def main():
    parser = argparse.ArgumentParser(description="Clean data và ghi lại file")
    parser.add_argument("--data-dir", default="../../data", help="Thư mục chứa categories.json, products.ndjson, blogs.ndjson")
    args = parser.parse_args()

    data_dir = Path(args.data_dir).resolve()
    if not data_dir.exists():
        print(f"[ERROR] Thư mục không tồn tại: {data_dir}", file=sys.stderr)
        sys.exit(1)

    # Load
    categories = json.loads((data_dir / "categories.json").read_text(encoding="utf-8")) if (data_dir / "categories.json").exists() else []
    products = [json.loads(l) for l in (data_dir / "products.ndjson").read_text(encoding="utf-8").strip().split("\n") if l.strip()] if (data_dir / "products.ndjson").exists() else []
    blogs = [json.loads(l) for l in (data_dir / "blogs.ndjson").read_text(encoding="utf-8").strip().split("\n") if l.strip()] if (data_dir / "blogs.ndjson").exists() else []

    print(f"[INFO] Loaded: {len(categories)} cat, {len(products)} prod, {len(blogs)} blogs", file=sys.stderr)

    # Clean
    categories = clean_categories_for_mongo(categories)
    products = clean_products_for_mongo(products)
    blogs = clean_blogs_for_mongo(blogs)
    print(f"[INFO] Sau clean: {len(products)} products (deduplicated)", file=sys.stderr)

    # Write back
    (data_dir / "categories.json").write_text(json.dumps(categories, ensure_ascii=False, indent=2), encoding="utf-8")
    (data_dir / "products.ndjson").write_text("\n".join(json.dumps(p, ensure_ascii=False) for p in products), encoding="utf-8")
    (data_dir / "blogs.ndjson").write_text("\n".join(json.dumps(b, ensure_ascii=False) for b in blogs), encoding="utf-8")

    print(f"[DONE] Đã ghi file đã clean vào {data_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()
