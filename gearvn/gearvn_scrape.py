import argparse
import json
import re
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://gearvn.com"
SITEMAP_INDEX = f"{BASE_URL}/sitemap.xml"
MENU_DESKTOP_URL = f"{BASE_URL}/pages/lien-he?view=menu.desk"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
})


def request_with_retry(url: str, timeout: int = 30, retries: int = 3) -> requests.Response:
    last_exc: Optional[Exception] = None
    for attempt in range(retries):
        try:
            resp = SESSION.get(url, timeout=timeout)
            resp.raise_for_status()
            return resp
        except Exception as exc:
            last_exc = exc
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)
    raise last_exc  # type: ignore[misc]


def fetch_text(url: str, timeout: int = 30) -> str:
    resp = request_with_retry(url, timeout=timeout)
    return resp.text


def fetch_json(url: str, timeout: int = 30) -> Optional[Dict]:
    try:
        resp = request_with_retry(url, timeout=timeout)
        return resp.json()
    except Exception:
        return None


def parse_sitemap_index(xml_text: str) -> List[str]:
    return [loc.strip() for loc in re.findall(r"<loc>(.*?)</loc>", xml_text)]


def parse_sitemap_urls(xml_text: str) -> List[str]:
    return [loc.strip() for loc in re.findall(r"<loc>(.*?)</loc>", xml_text)]


def normalize_handle(url: str, prefix: str) -> Optional[str]:
    try:
        path = urlparse(url).path
    except Exception:
        return None
    if not path.startswith(prefix):
        return None
    handle = path[len(prefix):].strip("/")
    return handle or None


def build_categories_from_menu(html: str) -> Tuple[List[Dict], Dict[str, int]]:
    soup = BeautifulSoup(html, "html.parser")
    categories: List[Dict] = []
    collection_to_id: Dict[str, int] = {}
    seen: Dict[Tuple[str, str, Optional[int]], int] = {}
    next_id = 1

    def add_category(name: str, url: Optional[str], parent_id: Optional[int], level: int,
                     cat_type: str, handle: Optional[str], source: str) -> int:
        nonlocal next_id
        key = (cat_type, url or name, parent_id)
        if key in seen:
            return seen[key]
        cid = next_id
        next_id += 1
        categories.append({
            "id": cid,
            "name": name,
            "url": url,
            "handle": handle,
            "parent_id": parent_id,
            "level": level,
            "type": cat_type,
            "source": source,
        })
        seen[key] = cid
        if handle:
            collection_to_id[handle] = cid
        return cid

    for mega in soup.select("li.megamenu-item"):
        link = mega.select_one("a.megamenu-link")
        if not link:
            continue
        name_node = link.select_one(".megamenu-name")
        name = (name_node.get_text(strip=True) if name_node else link.get_text(strip=True))
        href = link.get("href")
        url = urljoin(BASE_URL, href) if href else None
        handle = normalize_handle(url or "", "/collections/")
        top_id = add_category(name, url, None, 1, "product", handle, "menu.desk")

        for group in mega.select(".sub-megamenu-item"):
            group_link = group.select_one("a.sub-megamenu-item-name")
            if not group_link:
                continue
            group_name = group_link.get_text(strip=True)
            group_href = group_link.get("href")
            group_url = urljoin(BASE_URL, group_href) if group_href else None
            group_handle = normalize_handle(group_url or "", "/collections/")
            group_id = add_category(group_name, group_url, top_id, 2, "product", group_handle, "menu.desk")

            for item in group.select("a.sub-megamenu-item-filter"):
                item_name = item.get_text(strip=True)
                item_href = item.get("href")
                item_url = urljoin(BASE_URL, item_href) if item_href else None
                item_handle = normalize_handle(item_url or "", "/collections/")
                add_category(item_name, item_url, group_id, 3, "product", item_handle, "menu.desk")

    return categories, collection_to_id


def load_sitemaps() -> Tuple[List[str], List[str], List[str]]:
    index_xml = fetch_text(SITEMAP_INDEX)
    sitemap_urls = parse_sitemap_index(index_xml)
    product_maps = [u for u in sitemap_urls if "sitemap_products" in u]
    blog_maps = [u for u in sitemap_urls if "sitemap_blogs" in u]
    collection_maps = [u for u in sitemap_urls if "sitemap_collections" in u]
    return product_maps, blog_maps, collection_maps


def load_urls_from_sitemaps(sitemap_urls: List[str]) -> List[str]:
    urls: List[str] = []
    for sm in sitemap_urls:
        xml = fetch_text(sm)
        urls.extend(parse_sitemap_urls(xml))
    return sorted(set(urls))


def fetch_collection_title(handle: str) -> Optional[str]:
    url = f"{BASE_URL}/collections/{handle}.json"
    data = fetch_json(url)
    if not data:
        return None
    collection = data.get("collection")
    if not collection:
        return None
    return collection.get("title")


def ensure_collection_categories(collection_handles: Set[str],
                                 categories: List[Dict],
                                 collection_to_id: Dict[str, int]) -> None:
    next_id = max((c["id"] for c in categories), default=0) + 1
    for handle in sorted(collection_handles):
        if handle in collection_to_id:
            continue
        title = fetch_collection_title(handle) or handle
        cid = next_id
        next_id += 1
        categories.append({
            "id": cid,
            "name": title,
            "url": f"{BASE_URL}/collections/{handle}",
            "handle": handle,
            "parent_id": None,
            "level": 1,
            "type": "product",
            "source": "collections",
        })
        collection_to_id[handle] = cid


def build_product_collection_map(handles: Set[str], sleep_sec: float = 0.2) -> Dict[str, Set[str]]:
    product_to_collections: Dict[str, Set[str]] = defaultdict(set)
    for idx, handle in enumerate(sorted(handles), 1):
        page = 1
        while True:
            url = f"{BASE_URL}/collections/{handle}/products.json?limit=250&page={page}"
            data = fetch_json(url)
            if not data:
                break
            products = data.get("products", [])
            if not products:
                break
            for p in products:
                h = p.get("handle")
                if h:
                    product_to_collections[h].add(handle)
            if len(products) < 250:
                break
            page += 1
            time.sleep(sleep_sec)
        if idx % 50 == 0:
            print(f"[INFO] collections scanned: {idx}/{len(handles)}", file=sys.stderr)
    return product_to_collections


def product_json_url(product_url: str) -> Optional[str]:
    handle = normalize_handle(product_url, "/products/")
    if not handle:
        return None
    return f"{BASE_URL}/products/{handle}.json"


def blog_json_url(blog_url: str) -> Optional[Tuple[str, str, str]]:
    path = urlparse(blog_url).path.strip("/")
    parts = path.split("/")
    if len(parts) < 3 or parts[0] != "blogs":
        return None
    blog_handle = parts[1]
    article_handle = parts[2]
    return blog_handle, article_handle, f"{BASE_URL}/blogs/{blog_handle}/{article_handle}.json"


def fetch_product(product_url: str,
                  product_to_collections: Dict[str, Set[str]],
                  collection_to_id: Dict[str, int]) -> Optional[Dict]:
    json_url = product_json_url(product_url)
    if not json_url:
        return None
    data = fetch_json(json_url)
    if not data:
        return None
    product = data.get("product")
    if not product:
        return None
    handle = product.get("handle")
    collections = product_to_collections.get(handle, set())
    category_ids = [collection_to_id[c] for c in collections if c in collection_to_id]
    return {
        "id": product.get("id"),
        "handle": handle,
        "title": product.get("title"),
        "vendor": product.get("vendor"),
        "product_type": product.get("product_type"),
        "tags": product.get("tags"),
        "body_html": product.get("body_html"),
        "created_at": product.get("created_at"),
        "updated_at": product.get("updated_at"),
        "published_at": product.get("published_at"),
        "url": product_url,
        "images": product.get("images"),
        "options": product.get("options"),
        "variants": product.get("variants"),
        "category_ids": sorted(set(category_ids)),
        "collection_handles": sorted(collections),
    }


def fetch_blog(blog_url: str, blog_cat_map: Dict[str, int]) -> Optional[Dict]:
    meta = blog_json_url(blog_url)
    if not meta:
        return None
    blog_handle, article_handle, json_url = meta
    data = fetch_json(json_url)
    if not data:
        return None
    article = data.get("article")
    if not article:
        return None
    return {
        "id": article.get("id"),
        "blog_handle": blog_handle,
        "handle": article_handle,
        "title": article.get("title"),
        "author": article.get("author"),
        "created_at": article.get("created_at"),
        "published_at": article.get("published_at"),
        "updated_at": article.get("updated_at"),
        "body_html": article.get("body_html"),
        "summary_html": article.get("summary_html"),
        "tags": article.get("tags"),
        "image": article.get("image"),
        "url": blog_url,
        "category_id": blog_cat_map.get(blog_handle),
    }


def write_ndjson(path: Path, items: List[Dict]) -> None:
    with path.open("a", encoding="utf-8") as fh:
        for item in items:
            fh.write(json.dumps(item, ensure_ascii=False) + "\n")


def load_existing_handles(path: Path, key: str) -> Set[str]:
    if not path.exists():
        return set()
    handles: Set[str] = set()
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                doc = json.loads(line)
            except json.JSONDecodeError:
                continue
            value = doc.get(key)
            if value:
                handles.add(value)
    return handles


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape GearVN products, blogs, categories")
    parser.add_argument("--output-dir", default=r"C:\data\gearvn")
    parser.add_argument("--concurrency", type=int, default=16)
    parser.add_argument("--product-limit", type=int, default=0)
    parser.add_argument("--blog-limit", type=int, default=0)
    parser.add_argument("--skip-collection-map", action="store_true")
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("[INFO] loading sitemaps", file=sys.stderr)
    product_maps, blog_maps, collection_maps = load_sitemaps()

    print("[INFO] loading product urls", file=sys.stderr)
    product_urls = load_urls_from_sitemaps(product_maps)
    if args.product_limit:
        product_urls = product_urls[: args.product_limit]

    print("[INFO] loading blog urls", file=sys.stderr)
    blog_urls = load_urls_from_sitemaps(blog_maps)
    if args.blog_limit:
        blog_urls = blog_urls[: args.blog_limit]

    print("[INFO] loading collection urls", file=sys.stderr)
    collection_urls = load_urls_from_sitemaps(collection_maps)
    collection_handles = set()
    for url in collection_urls:
        handle = normalize_handle(url, "/collections/")
        if handle:
            collection_handles.add(handle)

    print("[INFO] parsing menu categories", file=sys.stderr)
    menu_html = fetch_text(MENU_DESKTOP_URL)
    categories, collection_to_id = build_categories_from_menu(menu_html)

    print("[INFO] ensuring collection categories", file=sys.stderr)
    ensure_collection_categories(collection_handles, categories, collection_to_id)

    blog_handles = sorted({urlparse(u).path.strip("/").split("/")[1] for u in blog_urls if "/blogs/" in u})
    next_id = max((c["id"] for c in categories), default=0) + 1
    blog_cat_map: Dict[str, int] = {}
    for handle in blog_handles:
        blog_cat_map[handle] = next_id
        categories.append({
            "id": next_id,
            "name": handle,
            "url": f"{BASE_URL}/blogs/{handle}",
            "handle": handle,
            "parent_id": None,
            "level": 1,
            "type": "blog",
            "source": "blogs",
        })
        next_id += 1

    categories_path = output_dir / "categories.json"
    categories_path.write_text(json.dumps(categories, ensure_ascii=False, indent=2), encoding="utf-8")

    map_path = output_dir / "product_collection_map.json"
    product_to_collections: Dict[str, Set[str]] = defaultdict(set)
    if not args.skip_collection_map:
        if map_path.exists():
            print("[INFO] loading existing product-collection map", file=sys.stderr)
            raw = json.loads(map_path.read_text(encoding="utf-8"))
            for k, v in raw.items():
                product_to_collections[k] = set(v)
        else:
            print("[INFO] building product-collection map", file=sys.stderr)
            product_to_collections = build_product_collection_map(collection_handles)
            map_path.write_text(json.dumps({k: sorted(v) for k, v in product_to_collections.items()}, ensure_ascii=False), encoding="utf-8")

    products_path = output_dir / "products.ndjson"
    existing_products = load_existing_handles(products_path, "handle") if args.resume else set()
    if not args.resume and products_path.exists():
        products_path.unlink()

    print(f"[INFO] scraping products (skip={len(existing_products)})", file=sys.stderr)
    filtered_product_urls = []
    for url in product_urls:
        handle = normalize_handle(url, "/products/")
        if handle and handle in existing_products:
            continue
        filtered_product_urls.append(url)

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [executor.submit(fetch_product, url, product_to_collections, collection_to_id)
                   for url in filtered_product_urls]
        batch: List[Dict] = []
        for idx, future in enumerate(as_completed(futures), 1):
            item = future.result()
            if item:
                batch.append(item)
            if len(batch) >= 200:
                write_ndjson(products_path, batch)
                batch = []
            if idx % 500 == 0:
                print(f"[INFO] products processed: {idx}/{len(filtered_product_urls)}", file=sys.stderr)
        if batch:
            write_ndjson(products_path, batch)

    blogs_path = output_dir / "blogs.ndjson"
    existing_blogs = load_existing_handles(blogs_path, "handle") if args.resume else set()
    if not args.resume and blogs_path.exists():
        blogs_path.unlink()

    print(f"[INFO] scraping blogs (skip={len(existing_blogs)})", file=sys.stderr)
    filtered_blog_urls = []
    for url in blog_urls:
        meta = blog_json_url(url)
        if not meta:
            continue
        _, article_handle, _ = meta
        if article_handle in existing_blogs:
            continue
        filtered_blog_urls.append(url)

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [executor.submit(fetch_blog, url, blog_cat_map) for url in filtered_blog_urls]
        batch = []
        for idx, future in enumerate(as_completed(futures), 1):
            item = future.result()
            if item:
                batch.append(item)
            if len(batch) >= 200:
                write_ndjson(blogs_path, batch)
                batch = []
            if idx % 500 == 0:
                print(f"[INFO] blogs processed: {idx}/{len(filtered_blog_urls)}", file=sys.stderr)
        if batch:
            write_ndjson(blogs_path, batch)

    print("[DONE] categories.json, products.ndjson, blogs.ndjson", file=sys.stderr)


if __name__ == "__main__":
    main()
