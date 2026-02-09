#!/usr/bin/env python3
"""
Xgear + GearVN (Bàn - Ghế) Scraper for AuraPC
Scrapes: xgear.net (Laptop, PC, Màn hình, Linh kiện, Gaming Gear, Phụ kiện) + gearvn.com (Bàn - Ghế)
Output: categories.json, products.ndjson, blogs.ndjson - AuraPC compatible format
"""

import argparse
import json
import re
import sys
import time
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# === CONFIG ===
XGEAR_BASE = "https://xgear.net"
GEARVN_BASE = "https://gearvn.com"
GEARVN_COLLECTIONS_URL = f"{GEARVN_BASE}/collections.json"
GEARVN_BAN_GHE_MAIN = "ghe-gia-tot"  # Ghế - Bàn chính
XGEAR_BLOGS_URL = "https://xgear.net/blogs/all"

# Main collections to scrape (level 1). ban-ghe added separately (GearVN)
MAIN_COLLECTIONS = {
    "laptop": "Laptop",
    "pc": "PC",
    "man-hinh": "Màn hình",
    "linh-kien": "Linh Kiện",
    "gaming-gear": "Gaming Gear",
    "phu-kien": "Phụ kiện",
}

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
})


# === HELPERS ===
def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-")


def request_with_retry(
    url: str, timeout: int = 30, retries: int = 3, session: Optional[requests.Session] = None
) -> requests.Response:
    s = session or requests.Session()
    s.headers.setdefault("User-Agent", SESSION.headers["User-Agent"])
    last_exc = None
    for attempt in range(retries):
        try:
            resp = s.get(url, timeout=timeout)
            resp.raise_for_status()
            return resp
        except Exception as exc:
            last_exc = exc
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    raise last_exc


def fetch_json(url: str, session: Optional[requests.Session] = None) -> Optional[Dict]:
    try:
        resp = request_with_retry(url, session=session or SESSION)
        return resp.json()
    except Exception:
        return None


def fetch_text(url: str, session: Optional[requests.Session] = None) -> str:
    resp = request_with_retry(url, session=session or SESSION)
    return resp.text


def fetch_gearvn_ban_ghe_collections() -> List[Tuple[str, str]]:
    """Fetch GearVN collections for Bàn - Ghế (ghe-*, ban-* excluding ban-phim)."""
    data = fetch_json(GEARVN_COLLECTIONS_URL)
    if not data:
        return [(GEARVN_BAN_GHE_MAIN, "Ghế giá tốt")]
    result: List[Tuple[str, str]] = []
    seen = set()
    for c in data.get("collections", []):
        h = (c.get("handle") or "").strip()
        t = (c.get("title") or h).strip()
        if not h or h in seen:
            continue
        # ghe-* = ghế; ban-* but NOT ban-phim = bàn (table)
        if h.startswith("ghe-"):
            result.append((h, t))
            seen.add(h)
        elif h.startswith("ban-") and "phim" not in h:
            result.append((h, t))
            seen.add(h)
    if not result:
        result = [(GEARVN_BAN_GHE_MAIN, "Ghế giá tốt")]
    # Luôn có collection chính
    handles_only = {h for h, _ in result}
    if GEARVN_BAN_GHE_MAIN not in handles_only:
        result.insert(0, (GEARVN_BAN_GHE_MAIN, "Ghế giá tốt"))
    return result


# === CATEGORIES ===
def build_categories(output_dir: Path) -> Tuple[List[Dict], Dict[str, int], Set[str], Set[str]]:
    """Build category tree from collections.json + add Bàn - Ghế from GearVN."""
    data = fetch_json(f"{XGEAR_BASE}/collections.json")
    if not data:
        raise RuntimeError("Could not fetch collections.json")

    raw = data.get("collections", [])
    categories: List[Dict] = []
    handle_to_id: Dict[str, int] = {}
    parent_map: Dict[str, str] = {}  # child_handle -> parent_handle
    next_id = 1

    def add_cat(name: str, handle: str, parent_handle: Optional[str], level: int, source: str = "xgear"):
        nonlocal next_id
        cid = next_id
        next_id += 1
        slug = slugify(name) or handle
        categories.append({
            "id": cid,
            "name": name,
            "slug": slug,
            "handle": handle,
            "url": f"{XGEAR_BASE}/collections/{handle}" if source == "xgear" else f"{GEARVN_BASE}/collections/{handle}",
            "parent_handle": parent_handle,
            "level": level,
            "source": source,
            "order": cid,
        })
        handle_to_id[handle] = cid
        if parent_handle:
            parent_map[handle] = parent_handle
        return cid

    # Level 1: main collections
    for h, title in MAIN_COLLECTIONS.items():
        if h not in handle_to_id:
            add_cat(title, h, None, 1)

    # Bàn - Ghế: level 1 từ GearVN
    if "ban-ghe" not in handle_to_id:
        add_cat("Bàn - Ghế", "ban-ghe", None, 1, source="gearvn")
    for c in categories:
        if c.get("handle") == "ban-ghe":
            c["url"] = f"{GEARVN_BASE}/collections/{GEARVN_BAN_GHE_MAIN}"
            break

    # Bàn - Ghế sub-categories: từ GearVN collections (ghe-*, ban-* không phải ban-phim)
    gearvn_ban_ghe = fetch_gearvn_ban_ghe_collections()
    for handle, title in gearvn_ban_ghe:
        if handle not in handle_to_id:
            add_cat(title, handle, "ban-ghe", 2, source="gearvn")

    # Level 2 & 3: from Xgear collections.json
    for c in raw:
        handle = c.get("handle") or ""
        title = c.get("title") or handle
        if not handle:
            continue
        if handle in handle_to_id:
            continue

        if handle.startswith("laptop-"):
            parent = "laptop"
        elif handle.startswith("pc-") or handle == "pc":
            parent = "pc"
        elif handle.startswith("man-hinh-") or "man-hinh" in handle:
            parent = "man-hinh"
        elif handle.startswith("linh-kien-") or any(
            x in handle for x in ["ram", "ssd", "cpu", "vga", "mainboard", "nguon", "case", "tan-nhiet"]
        ):
            parent = "linh-kien"
        elif handle.startswith("gaming-gear-") or handle == "gaming-gear":
            parent = "gaming-gear"
        elif any(x in handle for x in ["chuot", "ban-phim", "tai-nghe", "loa", "microphone", "lot-chuot", "tay-cam", "webcam", "dia-choi-game"]):
            parent = "gaming-gear"
        elif handle.startswith("phu-kien-") or "phu-kien" in handle:
            parent = "phu-kien"
        elif any(x in handle for x in ["balo", "de-tan-nhiet", "router"]):
            parent = "phu-kien"
        else:
            continue

        if parent not in handle_to_id:
            add_cat(MAIN_COLLECTIONS.get(parent, parent), parent, None, 1)

        parts = handle.replace(f"{parent}-", "").split("-")
        if len(parts) <= 2 and "-" in handle.replace(f"{parent}-", ""):
            add_cat(title, handle, parent, 2)
        else:
            add_cat(title, handle, parent, 2)

    # Bàn - Ghế: main category from MAIN_COLLECTIONS (ban-ghe), products from GearVN

    # Collection handles to scrape (skip sale/promo for cleaner data)
    skip = ("sale", "black-friday", "halloween", "cuoi-nam")
    collection_handles = {h for h in handle_to_id if not any(s in h for s in skip)}

    # GearVN ban-ghe handles: skip in Xgear scrape (scraped separately)
    gearvn_handles = {"ban-ghe"} | {h for h, t in gearvn_ban_ghe}
    return categories, handle_to_id, collection_handles, gearvn_handles


# === PRODUCT TRANSFORM ===
def parse_specs_from_html(html: str) -> Dict[str, str]:
    """Extract key-value specs from HTML table."""
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


def transform_product(p: Dict, collection_handles: Set[str], handle_to_id: Dict[str, int]) -> Dict:
    """Transform Haravan product to AuraPC format."""
    handle = p.get("handle", "")
    title = p.get("title", "")
    vendor = p.get("vendor", "")
    body_html = p.get("body_html", "") or ""

    variants = p.get("variants", [])
    v = variants[0] if variants else {}
    price = int(v.get("price", 0) or 0)
    compare_at = int(v.get("compare_at_price", 0) or 0)
    sale_price = price if price else None
    original_price = compare_at if compare_at else price
    if sale_price and original_price and original_price > sale_price:
        discount_pct = round((1 - sale_price / original_price) * 100)
    else:
        discount_pct = 0

    images = p.get("images", [])
    img_urls = [img.get("src") for img in sorted(images, key=lambda x: x.get("position", 0)) if img.get("src")]
    main_img = img_urls[0] if img_urls else ""
    gallery = img_urls[1:] if len(img_urls) > 1 else []

    for i, u in enumerate(img_urls):
        if u and not u.startswith("http"):
            img_urls[i] = "https:" + u
    if main_img and not main_img.startswith("http"):
        main_img = "https:" + main_img
    gallery = [u if u.startswith("http") else "https:" + u for u in gallery if u]

    specs = parse_specs_from_html(body_html)

    category_ids = [handle_to_id[h] for h in collection_handles if h in handle_to_id]
    primary_cat = category_ids[0] if category_ids else None

    return {
        "source": "xgear",
        "sourceId": str(p.get("id", "")),
        "handle": handle,
        "name": title,
        "slug": slugify(title) or handle,
        "shortDescription": (BeautifulSoup(body_html, "lxml").get_text()[:200] if body_html else ""),
        "description": body_html,
        "price": price,
        "salePrice": sale_price if discount_pct else None,
        "originalPrice": original_price,
        "discountPercent": discount_pct,
        "brand": vendor,
        "origin": "",  # Xgear doesn't provide in API
        "categoryIds": category_ids,
        "primaryCategoryId": primary_cat,
        "collectionHandles": list(collection_handles),
        "images": [{"url": main_img, "alt": title, "isMain": True}] + [{"url": u, "alt": "", "isMain": False} for u in gallery],
        "mainImage": main_img,
        "galleryImages": gallery,
        "specs": specs,
        "techSpecs": specs,
        "tags": p.get("tags", []),
        "productType": p.get("product_type", ""),
        "url": f"{XGEAR_BASE}/products/{handle}",
        "available": p.get("available", True),
    }


# === SCRAPE PRODUCTS ===
def scrape_products(
    output_dir: Path,
    categories: List[Dict],
    handle_to_id: Dict[str, int],
    collection_handles: Set[str],
    product_limit: int = 0,
    resume: bool = False,
    gearvn_handles: Optional[Set[str]] = None,
) -> None:
    products_path = output_dir / "products.ndjson"
    seen: Set[str] = set()
    if resume and products_path.exists():
        with products_path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    doc = json.loads(line)
                    seen.add(doc.get("handle", ""))
                except Exception:
                    pass

    if not resume and products_path.exists():
        products_path.unlink()

    collected: Dict[str, Dict] = {}
    total = 0
    gearvn_handles = gearvn_handles or {"ban-ghe"}
    for coll_handle in collection_handles:
        if coll_handle in gearvn_handles:
            continue  # Scraped separately via scrape_gearvn_ban_ghe
        if coll_handle not in handle_to_id:
            continue
        base_url = XGEAR_BASE
        page = 1
        while True:
            url = f"{base_url}/collections/{coll_handle}/products.json?limit=250&page={page}"
            data = fetch_json(url)
            if not data:
                break
            prods = data.get("products", [])
            if not prods:
                break
            for p in prods:
                h = p.get("handle")
                if not h:
                    continue
                colls = collected.get(h, {}).get("collectionHandles", set()) if h in collected else set()
                colls = set(colls) | {coll_handle}
                doc = transform_product(p, colls, handle_to_id)
                if h in collected:
                    # Merge category IDs
                    doc["categoryIds"] = sorted(set(doc.get("categoryIds", []) + collected[h].get("categoryIds", [])))
                    doc["collectionHandles"] = list(colls)
                collected[h] = doc
                if h not in seen:
                    seen.add(h)
                    total += 1
                if product_limit and total >= product_limit:
                    break
            if product_limit and total >= product_limit:
                break
            if len(prods) < 250:
                break
            page += 1
            time.sleep(0.2)
        if product_limit and total >= product_limit:
            break
        time.sleep(0.1)

    with products_path.open("a", encoding="utf-8") as f:
        for doc in collected.values():
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
    print(f"[INFO] Products written: {len(collected)}", file=sys.stderr)


# === GEARVN BÀN - GHẾ (Chairs & Tables) ===
def scrape_gearvn_ban_ghe(
    output_dir: Path,
    handle_to_id: Dict[str, int],
    product_limit: int = 0,
) -> None:
    """Scrape Bàn - Ghế from GearVN: multiple collections, sub-categories với parent_id."""
    ban_ghe_id = handle_to_id.get("ban-ghe")
    if not ban_ghe_id:
        return
    collections = fetch_gearvn_ban_ghe_collections()
    products_path = output_dir / "products.ndjson"
    seen: Set[str] = set()
    if products_path.exists():
        with products_path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    doc = json.loads(line)
                    seen.add(doc.get("handle", ""))
                except Exception:
                    pass
    original_seen = set(seen)

    collected: Dict[str, Dict] = {}
    total_new = 0
    for coll_handle, _ in collections:
        if coll_handle not in handle_to_id:
            continue
        page = 1
        while True:
            url = f"{GEARVN_BASE}/collections/{coll_handle}/products.json?limit=250&page={page}"
            data = fetch_json(url)
            if not data:
                break
            prods = data.get("products", [])
            if not prods:
                break
            for p in prods:
                h = p.get("handle")
                if not h:
                    continue
                prev = collected.get(h, {}).get("collectionHandles", set()) if h in collected else set()
                coll_handles = set(prev) | {"ban-ghe", coll_handle}
                doc = transform_product(p, coll_handles, handle_to_id)
                doc["source"] = "gearvn"
                doc["url"] = f"{GEARVN_BASE}/products/{h}"
                if h in collected:
                    doc["categoryIds"] = sorted(set(doc.get("categoryIds", []) + collected[h].get("categoryIds", [])))
                    doc["collectionHandles"] = list(coll_handles)
                collected[h] = doc
                if h not in seen:
                    seen.add(h)
                    total_new += 1
                if product_limit and total_new >= product_limit:
                    break
            if product_limit and total_new >= product_limit:
                break
            if len(prods) < 250:
                break
            page += 1
            time.sleep(0.2)
        if product_limit and total_new >= product_limit:
            break
        time.sleep(0.1)

    # Chỉ append sản phẩm mới (tránh trùng khi --resume)
    with products_path.open("a", encoding="utf-8") as f:
        for h, doc in collected.items():
            if h not in original_seen:
                f.write(json.dumps(doc, ensure_ascii=False) + "\n")
    print(f"[INFO] GearVN Bàn - Ghế products added: {total_new} ({len(collected)} total)", file=sys.stderr)


# === BLOGS ===
def _parse_article_page(html: str, url: str, blog_handle: str, article_handle: str) -> dict | None:
    """Parse article HTML page into structured doc."""
    soup = BeautifulSoup(html, "lxml")
    h1 = soup.select_one("h1")
    title = (h1.get_text(strip=True) if h1 else "").strip()
    if not title:
        return None

    # Date/author: "29/11/2024 | Bích Ngân" or similar
    meta_el = soup.select_one(".date-time, .article__meta, .article-meta, [class*='article'] [class*='meta'], .blog-article__meta")
    published_str = ""
    author = "AuraPC"
    if meta_el:
        txt = meta_el.get_text(strip=True)
        if "|" in txt:
            parts = txt.split("|", 1)
            published_str = parts[0].strip()
            if len(parts) > 1:
                author = parts[1].strip()
        else:
            published_str = txt
    # Parse dd/mm/yyyy
    published_at = None
    if published_str:
        try:
            from datetime import datetime
            dt = datetime.strptime(published_str.strip(), "%d/%m/%Y")
            published_at = dt.isoformat() + "Z"
        except Exception:
            published_at = published_str

    # Main content: start from h1 and get its containing article block
    content = ""
    body_el = None
    if h1:
        parent = h1.parent
        for _ in range(8):
            if not parent or not hasattr(parent, "get_text"):
                break
            txt = parent.get_text(strip=True)
            if len(txt) > 500 and "Tìm cửa hàng" not in txt and "Chọn tỉnh" not in txt:
                body_el = parent
                break
            parent = parent.parent if hasattr(parent, "parent") else None
    if not body_el:
        for sel in ("article", "main .rte", ".blog-article__content", "main"):
            el = soup.select_one(sel)
            if el and len(el.get_text(strip=True)) > 400 and "Tìm cửa hàng" not in el.get_text():
                body_el = el
                break
    if body_el:
        for img in body_el.find_all("img"):
            src = img.get("src", "")
            if src and not src.startswith("http"):
                img["src"] = "https:" + src if src.startswith("//") else f"{XGEAR_BASE}{src}" if src.startswith("/") else ""
        content = str(body_el)

    # Cover image: first img in content
    cover = ""
    if content:
        first_img = BeautifulSoup(content, "lxml").find("img")
        if first_img:
            cover = first_img.get("src", "") or ""

    excerpt = BeautifulSoup(content, "lxml").get_text(strip=True)[:400] if content else ""

    return {
        "source": "xgear",
        "handle": article_handle,
        "title": title,
        "slug": slugify(title) or article_handle,
        "excerpt": excerpt,
        "content": content,
        "coverImage": cover,
        "author": author,
        "publishedAt": published_at,
        "category": blog_handle,
        "url": url,
    }


def scrape_blogs(output_dir: Path, limit: int = 0) -> None:
    """Scrape blogs from xgear.net/blogs/all via HTML parsing."""
    seen = set()
    articles = []
    page = 1
    while True:
        url = f"{XGEAR_BLOGS_URL}?page={page}" if page > 1 else XGEAR_BLOGS_URL
        html = fetch_text(url)
        soup = BeautifulSoup(html, "lxml")
        links = []
        for a in soup.select("a[href*='/blogs/']"):
            href = (a.get("href") or "").strip()
            if "/blogs/" not in href or "/collections/" in href or "/blogs/all" in href:
                continue
            # /blogs/category/article-handle (need blogs + cat + article)
            parts = [p for p in href.rstrip("/").split("/") if p and p not in ("https:", "http:")]
            if len(parts) < 3 or "blogs" not in parts:
                continue
            idx = parts.index("blogs") if "blogs" in parts else -1
            if idx < 0 or idx + 2 >= len(parts):
                continue
            blog_handle = parts[idx + 1]
            article_handle = parts[idx + 2]
            if blog_handle == "all" or blog_handle == "blogs":
                continue
            if (blog_handle, article_handle) in seen:
                continue
            seen.add((blog_handle, article_handle))
            full_url = f"{XGEAR_BASE}/blogs/{blog_handle}/{article_handle}"
            links.append((blog_handle, article_handle, full_url))
        if not links:
            break
        for blog_handle, article_handle, full_url in links:
            art_html = fetch_text(full_url)
            doc = _parse_article_page(art_html, full_url, blog_handle, article_handle)
            if doc:
                articles.append(doc)
            if limit and len(articles) >= limit:
                break
            time.sleep(0.25)
        if limit and len(articles) >= limit:
            break
        # Pagination: check for next page
        next_lnk = soup.select_one(f"a[href*='page={page + 1}']")
        if not next_lnk:
            break
        page += 1
        time.sleep(0.2)

    blogs_path = output_dir / "blogs.ndjson"
    with blogs_path.open("w", encoding="utf-8") as f:
        for doc in articles:
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
    print(f"[INFO] Blogs written: {len(articles)}", file=sys.stderr)


# === AURAPC FORMAT (categories) ===
def write_aurapc_categories(categories: List[Dict], output_dir: Path) -> None:
    """Write categories in AuraPC format (slug, parent by slug)."""
    out = []
    slug_to_id = {}
    for c in categories:
        slug = c.get("slug") or slugify(c.get("name", ""))
        slug_to_id[slug] = c["id"]
    for c in categories:
        parent_slug = None
        if c.get("parent_handle"):
            for x in categories:
                if x.get("handle") == c["parent_handle"]:
                    parent_slug = x.get("slug")
                    break
        out.append({
            "id": c["id"],
            "name": c["name"],
            "slug": c.get("slug"),
            "parent": parent_slug,
            "order": c.get("order", 0),
            "source": c.get("source", "xgear"),
            "handle": c.get("handle"),
            "url": c.get("url"),
        })
    path = output_dir / "categories.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[INFO] Categories written: {path}", file=sys.stderr)


# === MAIN ===
def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape Xgear + GearVN Bàn - Ghế for AuraPC")
    parser.add_argument("--output-dir", default="data", help="Output directory")
    parser.add_argument("--product-limit", type=int, default=0)
    parser.add_argument("--blog-limit", type=int, default=0)
    parser.add_argument("--skip-products", action="store_true")
    parser.add_argument("--skip-blogs", action="store_true")
    parser.add_argument("--skip-ghe", action="store_true")
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("[INFO] Building categories...", file=sys.stderr)
    categories, handle_to_id, collection_handles, gearvn_handles = build_categories(output_dir)
    write_aurapc_categories(categories, output_dir)

    if not args.skip_products:
        print("[INFO] Scraping products...", file=sys.stderr)
        scrape_products(
            output_dir,
            categories,
            handle_to_id,
            collection_handles,
            product_limit=args.product_limit,
            resume=args.resume,
            gearvn_handles=gearvn_handles,
        )
        if not args.skip_ghe:
            print("[INFO] Scraping GearVN Bàn - Ghế...", file=sys.stderr)
            scrape_gearvn_ban_ghe(output_dir, handle_to_id, product_limit=args.product_limit)

    if not args.skip_blogs:
        print("[INFO] Scraping blogs...", file=sys.stderr)
        scrape_blogs(output_dir, limit=args.blog_limit)

    print("[DONE] categories.json, products.ndjson, blogs.ndjson", file=sys.stderr)


if __name__ == "__main__":
    main()
