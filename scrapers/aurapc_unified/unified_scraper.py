#!/usr/bin/env python3
"""
AuraPC Unified Scraper - Thống nhất data theo promptdata.md
Cào từ Xgear + GearVN -> Chuẩn hóa -> Đẩy MongoDB Atlas
- Categories: 7 Lv1, hierarchy 4 cấp, category_id = slug
- Products: max 50/danh mục, chỉ lưu URL ảnh
- Blogs: 100 bài mới nhất từ Xgear
"""
import argparse
import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# Optional: pymongo
try:
    from pymongo import MongoClient
    HAS_PYMONGO = True
except ImportError:
    HAS_PYMONGO = False

from category_tree import get_flat_categories, get_scrape_urls

# === CONFIG ===
XGEAR_BASE = "https://xgear.net"
GEARVN_BASE = "https://gearvn.com"
XGEAR_BLOGS = "https://xgear.net/blogs/all"
MONGO_URI = "mongodb+srv://thinh_admin:ThinhTran09082005%40@aurapc-cluster.mx54ozo.mongodb.net/AuraPC?retryWrites=true&w=majority"
DB_NAME = "AuraPC"
PRODUCTS_PER_CATEGORY = 50
BLOGS_LIMIT = 100

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
})


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-")


def fetch_json(url: str) -> Optional[Dict]:
    try:
        resp = SESSION.get(url, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def fetch_text(url: str) -> str:
    resp = SESSION.get(url, timeout=30)
    return resp.text


def to_products_url(collection_url: str) -> str:
    """Chuyển URL collection thành URL API products."""
    url = collection_url.rstrip("/")
    return f"{url}/products.json?limit=250&page=1"


def parse_specs_from_html(html: str) -> Dict[str, str]:
    specs = {}
    if not html:
        return specs
    soup = BeautifulSoup(html, "lxml")
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) >= 2:
                key = tds[0].get_text(strip=True)
                val = " ".join(tds[1].get_text(strip=True).split())
                if key and val:
                    specs[key] = val
    return specs


def sanitize_html(html: str) -> str:
    """Lọc bỏ script, style rác."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup.find_all(["script", "style", "iframe"]):
        tag.decompose()
    return str(soup)


def transform_product(p: Dict, category_id: str, base_url: str) -> Dict:
    """Chuyển Haravan product sang schema AuraPC."""
    handle = p.get("handle", "")
    title = p.get("title", "")
    variants = p.get("variants", [])
    v = variants[0] if variants else {}
    price = int(v.get("price", 0) or 0)
    compare_at = int(v.get("compare_at_price", 0) or 0)
    body_html = p.get("body_html", "") or ""
    images = p.get("images", [])
    img_urls = []
    for img in sorted(images, key=lambda x: x.get("position", 0)):
        src = img.get("src", "")
        if src:
            if not src.startswith("http"):
                src = "https:" + src
            img_urls.append(src)

    specs = parse_specs_from_html(body_html)
    description_html = sanitize_html(body_html)

    source = "xgear" if "xgear" in base_url else "gearvn"
    product_id = str(p.get("id", handle))
    slug_val = (handle or slugify(title) or product_id).strip()
    if not slug_val:
        slug_val = f"product-{product_id}"

    return {
        "product_id": product_id,
        "handle": handle,
        "slug": slug_val,
        "name": title,
        "price": price,
        "old_price": compare_at if compare_at else None,
        "images": img_urls,
        "category_id": category_id,
        "specs": specs,
        "description_html": description_html[:50000] if description_html else "",  # limit size
        "source": source,
        "url": f"{base_url}/products/{handle}",
    }


# === PHASE 1: CATEGORIES ===
def build_categories_for_mongo() -> List[Dict]:
    """Build danh sách categories theo schema MongoDB."""
    flat = get_flat_categories()
    return [
        {
            "category_id": c["category_id"],
            "parent_id": c["parent_id"],
            "level": c["level"],
            "name": c["name"],
            "slug": c["slug"],
            "source_url": c["source_url"],
            "source": c["source"],
        }
        for c in flat
    ]


# === PHASE 2: PRODUCTS ===
def scrape_products_for_category(
    slug: str, url: str, source: str, limit: int = 50
) -> List[Dict]:
    """Cào tối đa `limit` sản phẩm từ 1 collection."""
    base = XGEAR_BASE if source == "xgear" else GEARVN_BASE
    products_url = to_products_url(url)
    data = fetch_json(products_url)
    if not data:
        return []
    prods = data.get("products", [])[:limit]
    result = []
    for p in prods:
        doc = transform_product(p, slug, base)
        result.append(doc)
    return result


# === PHASE 3: BLOGS ===
def scrape_blogs(limit: int = 100) -> List[Dict]:
    """Cào blog từ Xgear /blogs/all."""
    seen: Set[tuple] = set()
    articles = []
    page = 1
    while len(articles) < limit:
        surl = f"{XGEAR_BLOGS}?page={page}" if page > 1 else XGEAR_BLOGS
        html = fetch_text(surl)
        soup = BeautifulSoup(html, "lxml")
        links = []
        for a in soup.select("a[href*='/blogs/']"):
            href = (a.get("href") or "").strip()
            if "/blogs/" not in href or "/collections/" in href or "/blogs/all" in href:
                continue
            parts = [p for p in href.rstrip("/").split("/") if p and p not in ("https:", "http:")]
            if len(parts) < 3 or "blogs" not in parts:
                continue
            idx = parts.index("blogs") if "blogs" in parts else -1
            if idx < 0 or idx + 2 >= len(parts):
                continue
            blog_handle, article_handle = parts[idx + 1], parts[idx + 2]
            if blog_handle == "all":
                continue
            if (blog_handle, article_handle) in seen:
                continue
            seen.add((blog_handle, article_handle))
            links.append((blog_handle, article_handle, f"{XGEAR_BASE}/blogs/{blog_handle}/{article_handle}"))
        if not links:
            break
        for bh, ah, full_url in links:
            if len(articles) >= limit:
                break
            art_html = fetch_text(full_url)
            doc = _parse_blog_article(art_html, full_url, bh, ah)
            if doc:
                articles.append(doc)
            time.sleep(0.2)
        page += 1
        time.sleep(0.2)
    return articles[:limit]


def _parse_blog_article(html: str, url: str, blog_handle: str, article_handle: str) -> Optional[Dict]:
    soup = BeautifulSoup(html, "lxml")
    h1 = soup.select_one("h1")
    title = (h1.get_text(strip=True) if h1 else "").strip()
    if not title:
        return None
    meta = soup.select_one(".date-time, .article__meta, .blog-article__meta")
    published_str = meta.get_text(strip=True).split("|")[0].strip() if meta else ""
    body_el = soup.select_one("article, main .rte, .blog-article__content, main")
    content = sanitize_html(str(body_el))[:30000] if body_el else ""
    return {
        "handle": article_handle,
        "title": title,
        "slug": slugify(title) or article_handle,
        "excerpt": (BeautifulSoup(content, "lxml").get_text(strip=True)[:400] if content else ""),
        "content": content,
        "category": blog_handle,
        "publishedAt": published_str,
        "url": url,
        "source": "xgear",
    }


# === CLEAN DATA FOR MONGODB ===
def clean_products_for_mongo(products: List[Dict]) -> List[Dict]:
    """
    Chuẩn hóa products trước khi insert MongoDB:
    - Thêm slug nếu thiếu (từ handle/name/product_id)
    - Deduplicate theo (source, product_id), gộp category_id vào category_ids
    - Loại bỏ sản phẩm không có slug hợp lệ
    """
    seen: Dict[tuple, Dict] = {}  # (source, product_id) -> doc
    for p in products:
        slug = p.get("slug") or p.get("handle") or slugify(p.get("name", "")) or str(p.get("product_id", ""))
        if not slug or not slug.strip():
            slug = f"product-{p.get('product_id', id(p))}"
        p["slug"] = slug.strip()
        key = (p.get("source", ""), str(p.get("product_id", "")))
        if key in seen:
            # Gộp category_id vào category_ids
            existing = seen[key]
            cat_ids = existing.get("category_ids") or [existing.get("category_id")] if existing.get("category_id") else []
            new_cat = p.get("category_id")
            if new_cat and new_cat not in cat_ids:
                cat_ids.append(new_cat)
            existing["category_ids"] = cat_ids
        else:
            p_copy = dict(p)
            p_copy["category_ids"] = [p.get("category_id")] if p.get("category_id") else []
            seen[key] = p_copy
    return list(seen.values())


def clean_categories_for_mongo(categories: List[Dict]) -> List[Dict]:
    """Đảm bảo categories có slug, parent_id hợp lệ."""
    cat_ids = {c.get("category_id") for c in categories if c.get("category_id")}
    result = []
    for c in categories:
        c = dict(c)
        if not c.get("slug"):
            c["slug"] = c.get("category_id", "") or f"cat-{id(c)}"
        if c.get("parent_id") and c["parent_id"] not in cat_ids:
            c["parent_id"] = None
        result.append(c)
    return result


def clean_blogs_for_mongo(blogs: List[Dict]) -> List[Dict]:
    """Đảm bảo blogs có slug unique, không null."""
    seen_slugs: Set[str] = set()
    result = []
    for i, b in enumerate(blogs):
        b = dict(b)
        slug = b.get("slug") or b.get("handle") or slugify(b.get("title", "")) or f"blog-{i}"
        while slug in seen_slugs:
            slug = f"{slug}-{i}"
        seen_slugs.add(slug)
        b["slug"] = slug
        result.append(b)
    return result


# === MONGODB ===
def push_to_mongo(
    categories: List[Dict],
    products: List[Dict],
    blogs: List[Dict],
    clear_first: bool = True,
) -> None:
    if not HAS_PYMONGO:
        print("[WARN] pymongo chưa cài. Chạy: pip install pymongo", file=sys.stderr)
        return
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    if clear_first:
        db.categories.delete_many({})
        db.products.delete_many({})
        db.blogs.delete_many({})
    if categories:
        db.categories.insert_many(categories)
        print(f"[INFO] MongoDB: {len(categories)} categories", file=sys.stderr)
    if products:
        db.products.insert_many(products)
        print(f"[INFO] MongoDB: {len(products)} products", file=sys.stderr)
    if blogs:
        db.blogs.insert_many(blogs)
        print(f"[INFO] MongoDB: {len(blogs)} blogs", file=sys.stderr)
    client.close()


# === MAIN ===
def main() -> None:
    parser = argparse.ArgumentParser(description="AuraPC Unified Scraper -> MongoDB")
    parser.add_argument("--output-dir", default="data", help="Thư mục lưu JSON (khi không push Mongo)")
    parser.add_argument("--no-mongo", action="store_true", help="Chỉ xuất file, không đẩy MongoDB")
    parser.add_argument("--skip-products", action="store_true")
    parser.add_argument("--skip-blogs", action="store_true")
    parser.add_argument("--product-limit", type=int, default=PRODUCTS_PER_CATEGORY)
    parser.add_argument("--blog-limit", type=int, default=BLOGS_LIMIT)
    parser.add_argument("--no-clear", action="store_true", help="Không xóa data cũ trước khi insert")
    args = parser.parse_args()

    # Phase 1: Categories
    print("[INFO] Phase 1: Building categories...", file=sys.stderr)
    categories = build_categories_for_mongo()
    print(f"[INFO] Categories: {len(categories)}", file=sys.stderr)

    # Phase 2: Products
    products: List[Dict] = []
    if not args.skip_products:
        print("[INFO] Phase 2: Scraping products...", file=sys.stderr)
        urls = get_scrape_urls()
        seen_urls: Dict[str, str] = {}  # url -> slug (tránh cào trùng URL)
        for slug, url, source in urls:
            if not url:
                continue
            if url in seen_urls:
                continue
            seen_urls[url] = slug
            prods = scrape_products_for_category(slug, url, source, limit=args.product_limit)
            if prods:
                print(f"  [OK] {slug}: {len(prods)} sp", file=sys.stderr)
                products.extend(prods)
            time.sleep(0.3)
        print(f"[INFO] Total products: {len(products)}", file=sys.stderr)

    # Phase 3: Blogs
    blogs: List[Dict] = []
    if not args.skip_blogs:
        print("[INFO] Phase 3: Scraping blogs...", file=sys.stderr)
        blogs = scrape_blogs(limit=args.blog_limit)
        print(f"[INFO] Blogs: {len(blogs)}", file=sys.stderr)

    # Phase 4: Clean & validate
    print("[INFO] Phase 4: Cleaning data for MongoDB...", file=sys.stderr)
    categories = clean_categories_for_mongo(categories)
    products = clean_products_for_mongo(products)
    blogs = clean_blogs_for_mongo(blogs)
    cat_ids = {c["category_id"] for c in categories if c.get("category_id")}
    for c in categories:
        pid = c.get("parent_id")
        if pid and pid not in cat_ids:
            print(f"  [WARN] parent_id={pid} không tồn tại (cat {c['category_id']})", file=sys.stderr)
    print(f"[INFO] Products after dedup: {len(products)}", file=sys.stderr)

    # Output
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "categories.json").write_text(json.dumps(categories, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "products.ndjson").write_text("\n".join(json.dumps(p, ensure_ascii=False) for p in products), encoding="utf-8")
    (output_dir / "blogs.ndjson").write_text("\n".join(json.dumps(b, ensure_ascii=False) for b in blogs), encoding="utf-8")
    print(f"[INFO] Files written to {output_dir}", file=sys.stderr)

    if not args.no_mongo and HAS_PYMONGO:
        print("[INFO] Pushing to MongoDB Atlas...", file=sys.stderr)
        push_to_mongo(categories, products, blogs, clear_first=not args.no_clear)
    elif args.no_mongo:
        print("[INFO] Bỏ qua MongoDB (--no-mongo)", file=sys.stderr)

    print("[DONE]", file=sys.stderr)


if __name__ == "__main__":
    main()
