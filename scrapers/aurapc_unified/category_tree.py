"""
Cây danh mục thống nhất theo promptdata.md
category_id = slug (handle từ URL), dùng làm ID duy nhất, không dùng 1,2,3...
"""
from typing import Dict, List, Any

XGEAR = "https://xgear.net"
GEARVN = "https://gearvn.com"


def _x(path: str) -> str:
    return f"{XGEAR}/collections/{path}" if path else ""


def _g(path: str) -> str:
    return f"{GEARVN}/collections/{path}" if path else ""


# Định nghĩa cây danh mục: (slug, name, url, source, children)
CATEGORY_TREE: List[Dict[str, Any]] = [
    {"slug": "laptop", "name": "Laptop", "url": _x("laptop"), "source": "xgear", "level": 1, "children": [
        {"slug": "laptop-msi", "name": "MSI", "url": _x("laptop-msi"), "source": "xgear", "children": [
            {"slug": "laptop-gaming-msi-creator", "name": "Creator", "url": _x("laptop-gaming-msi-creator"), "source": "xgear"},
            {"slug": "laptop-msi-cyborg-thin-gf-series", "name": "Cyborg / Thin GF", "url": _x("laptop-msi-cyborg-thin-gf-series"), "source": "xgear"},
            {"slug": "laptop-msi-sword-katana-series", "name": "Sword / Katana", "url": _x("laptop-msi-sword-katana-series"), "source": "xgear"},
            {"slug": "laptop-msi-crosshair-pulse-gp-series", "name": "Crosshair | Vector", "url": _x("laptop-msi-crosshair-pulse-gp-series"), "source": "xgear"},
            {"slug": "laptop-msi-ge-series", "name": "Raider GE", "url": _x("laptop-msi-ge-series"), "source": "xgear"},
            {"slug": "laptop-msi-gs-series", "name": "Stealth GS", "url": _x("laptop-msi-gs-series"), "source": "xgear"},
            {"slug": "laptop-msi-gt-series", "name": "Titan", "url": _x("laptop-msi-gt-series"), "source": "xgear"},
            {"slug": "laptop-msi-rtx-5000-series", "name": "MSI RTX 5000", "url": _x("laptop-msi-rtx-5000-series"), "source": "xgear"},
        ]},
        {"slug": "laptop-lenovo", "name": "LENOVO", "url": _x("laptop-lenovo"), "source": "xgear", "children": [
            {"slug": "loq-series", "name": "LOQ Series", "url": _x("loq-series"), "source": "xgear"},
            {"slug": "legion-gaming", "name": "Legion", "url": _x("legion-gaming"), "source": "xgear"},
        ]},
        {"slug": "laptop-gigabyte", "name": "GIGABYTE | AORUS", "url": _x("laptop-gigabyte"), "source": "xgear", "children": [
            {"slug": "laptop-gaming-gigabyte-aero", "name": "Aero", "url": _x("laptop-gaming-gigabyte-aero"), "source": "xgear"},
            {"slug": "laptop-gaming-gigabyte-aorus", "name": "Aorus", "url": _x("laptop-gaming-gigabyte-aorus"), "source": "xgear"},
            {"slug": "gigabyte-a16-series", "name": "A16 Series", "url": _x("gigabyte-a16-series"), "source": "xgear"},
            {"slug": "laptop-gigabyte-rtx-5000-series", "name": "Gigabyte RTX 5000", "url": _x("laptop-gigabyte-rtx-5000-series"), "source": "xgear"},
        ]},
        {"slug": "laptop-acer", "name": "ACER | PREDATOR", "url": _x("laptop-acer"), "source": "xgear", "children": [
            {"slug": "nitro-5", "name": "Nitro", "url": _x("nitro-5"), "source": "xgear"},
            {"slug": "helios", "name": "Helios", "url": _x("helios"), "source": "xgear"},
            {"slug": "aspire", "name": "Aspire", "url": _x("aspire"), "source": "xgear"},
        ]},
        {"slug": "laptop-asus", "name": "ASUS", "url": _x("laptop-asus"), "source": "xgear", "children": [
            {"slug": "rog-series", "name": "ASUS ROG", "url": _x("rog-series"), "source": "xgear", "children": [
                {"slug": "strix-g", "name": "ROG Strix G", "url": _x("strix-g"), "source": "xgear"},
                {"slug": "zephyrus", "name": "ROG Zephyrus", "url": _x("zephyrus"), "source": "xgear"},
                {"slug": "flow", "name": "ROG Flow", "url": _x("flow"), "source": "xgear"},
                {"slug": "scar", "name": "Scar", "url": _x("scar"), "source": "xgear"},
            ]},
            {"slug": "tuf-series", "name": "TUF Series", "url": _x("tuf-series"), "source": "xgear"},
            {"slug": "laptop-asus-rtx-5000-series", "name": "ASUS RTX 5000 Series", "url": _x("laptop-asus-rtx-5000-series"), "source": "xgear"},
            {"slug": "vivobook", "name": "Vivobook", "url": _x("vivobook"), "source": "xgear", "children": [
                {"slug": "asus-v16-gaming-creator", "name": "Vivobook Gaming", "url": _x("asus-v16-gaming-creator"), "source": "xgear"},
                {"slug": "laptop-van-phong", "name": "Vivobook văn phòng", "url": _x("laptop-van-phong"), "source": "xgear"},
            ]},
        ]},
        {"slug": "laptop-hp", "name": "HP", "url": _x("laptop-gaming-hp-victus"), "source": "xgear", "children": [
            {"slug": "laptop-gaming-hp-victus", "name": "Victus", "url": _x("laptop-gaming-hp-victus"), "source": "xgear"},
            {"slug": "omen", "name": "Omen", "url": _x("omen"), "source": "xgear"},
            {"slug": "laptop-hp-rtx-5000-series", "name": "HP RTX 5000 Series", "url": _x("laptop-hp-rtx-5000-series"), "source": "xgear"},
        ]},
        {"slug": "laptop-gaming-ai", "name": "Laptop A.I", "url": _x("laptop-gaming-ai"), "source": "xgear"},
        {"slug": "laptop-sinh-vien", "name": "SINH VIÊN", "url": _x("laptop-sinh-vien"), "source": "xgear"},
        {"slug": "laptop-hi-end", "name": "Hi - End", "url": _x("laptop-hi-end"), "source": "xgear"},
        {"slug": "laptop-van-phong", "name": "Văn phòng", "url": _x("laptop-van-phong"), "source": "xgear"},
    ]},
    {"slug": "pc", "name": "PC", "url": _x("pc"), "source": "xgear", "level": 1, "children": [
        {"slug": "pc-asus", "name": "PC Asus", "url": _x("pc-asus"), "source": "xgear"},
        {"slug": "pc-msi", "name": "PC MSI", "url": _x("pc-msi"), "source": "xgear"},
        {"slug": "pc-gigabyte", "name": "PC Gigabyte", "url": _x("pc-gigabyte"), "source": "xgear"},
        {"slug": "pc-gaming", "name": "PC gaming", "url": _x("pc-gaming"), "source": "xgear"},
        {"slug": "pc-do-hoa", "name": "PC đồ họa", "url": _x("pc-do-hoa"), "source": "xgear"},
        {"slug": "pc-van-phong", "name": "PC văn phòng", "url": _x("pc-van-phong"), "source": "xgear"},
        {"slug": "pc-gaming-ai", "name": "PC AI", "url": _x("pc-gaming-ai"), "source": "xgear"},
    ]},
    {"slug": "man-hinh", "name": "Màn hình", "url": _x("man-hinh"), "source": "xgear", "level": 1, "children": [
        {"slug": "man-hinh-asus", "name": "Asus", "url": _x("man-hinh-asus"), "source": "xgear"},
        {"slug": "man-hinh-samsung", "name": "Samsung", "url": _x("man-hinh-samsung"), "source": "xgear"},
        {"slug": "man-hinh-gigabyte", "name": "Gigabyte", "url": _x("man-hinh-gigabyte"), "source": "xgear"},
        {"slug": "man-hinh-koorui", "name": "Koorui", "url": _x("man-hinh-koorui"), "source": "xgear"},
        {"slug": "man-hinh-msi", "name": "MSI", "url": _x("man-hinh-msi"), "source": "xgear"},
        {"slug": "man-hinh-aoc", "name": "AOC", "url": _x("man-hinh-aoc"), "source": "xgear"},
        {"slug": "man-hinh-philips", "name": "Philips", "url": _x("man-hinh-philips"), "source": "xgear"},
        {"slug": "man-hinh-dell", "name": "Dell", "url": _x("man-hinh-dell"), "source": "xgear"},
        {"slug": "man-hinh-gaming", "name": "Gaming", "url": _x("man-hinh-gaming"), "source": "xgear"},
        {"slug": "man-hinh-do-hoa", "name": "Đồ họa", "url": _x("man-hinh-do-hoa"), "source": "xgear"},
        {"slug": "man-hinh-di-dong", "name": "Di động", "url": _x("man-hinh-di-dong"), "source": "xgear"},
    ]},
    {"slug": "linh-kien", "name": "Linh Kiện", "url": _x("linh-kien"), "source": "xgear", "level": 1, "children": [
        {"slug": "cpu", "name": "CPU", "url": _x("cpu"), "source": "xgear", "children": [
            {"slug": "cpu-intel", "name": "CPU Intel", "url": _x("cpu-intel"), "source": "xgear"},
            {"slug": "cpu-amd", "name": "CPU AMD", "url": _x("cpu-amd"), "source": "xgear"},
        ]},
        {"slug": "mainboard", "name": "Mainboard", "url": _x("mainboard"), "source": "xgear", "children": [
            {"slug": "mainboard-asus", "name": "Mainboard Asus", "url": _x("mainboard-asus"), "source": "xgear", "children": [
                {"slug": "mainboard-asus-amd", "name": "Mainboard AMD", "url": _x("mainboard-asus-amd"), "source": "xgear"},
                {"slug": "mainboard-asus-intel", "name": "Mainboard Intel", "url": _x("mainboard-asus-intel"), "source": "xgear"},
                {"slug": "mainboard-z890-asus-series", "name": "Mainboard Z890 Series", "url": _x("mainboard-z890-asus-series"), "source": "xgear"},
            ]},
            {"slug": "mainboard-gigabyte", "name": "Mainboard Gigabyte", "url": _x("mainboard-gigabyte"), "source": "xgear", "children": [
                {"slug": "mainboard-gigabyte-amd", "name": "Mainboard AMD", "url": _x("mainboard-gigabyte-amd"), "source": "xgear"},
                {"slug": "mainboard-gigabyte-intel", "name": "Mainboard Intel", "url": _x("mainboard-gigabyte-intel"), "source": "xgear"},
                {"slug": "mainboard-gigabyte-x870", "name": "Mainboard X870", "url": _x("mainboard-gigabyte-x870"), "source": "xgear"},
                {"slug": "mainboard-z890-gigabyte-series", "name": "Mainboard Z890 Series", "url": _x("mainboard-z890-gigabyte-series"), "source": "xgear"},
            ]},
            {"slug": "mainboard-msi", "name": "Mainboard MSI", "url": _x("mainboard-msi"), "source": "xgear", "children": [
                {"slug": "mainboard-msi-amd", "name": "Mainboard AMD", "url": _x("mainboard-msi-amd"), "source": "xgear"},
                {"slug": "mainboard-msi-intel", "name": "Mainboard Intel", "url": _x("mainboard-msi-intel"), "source": "xgear"},
                {"slug": "mainboard-msi-z890-series", "name": "Mainboard Z890 Series", "url": _x("mainboard-msi-z890-series"), "source": "xgear"},
            ]},
        ]},
        {"slug": "ram", "name": "RAM", "url": _x("ram"), "source": "xgear", "children": [
            {"slug": "ram-laptop", "name": "RAM Laptop", "url": _x("ram-laptop"), "source": "xgear"},
            {"slug": "ram-pc", "name": "RAM PC", "url": _x("ram-pc"), "source": "xgear", "children": [
                {"slug": "ram-corsair", "name": "RAM Corsair", "url": _x("ram-corsair"), "source": "xgear"},
                {"slug": "ram-g-skill", "name": "RAM G.skill", "url": _x("ram-g-skill"), "source": "xgear"},
                {"slug": "ram-kingston", "name": "RAM Kingston", "url": _x("ram-kingston"), "source": "xgear"},
                {"slug": "ram-teamgroup", "name": "RAM TeamGroup", "url": _x("ram-teamgroup"), "source": "xgear"},
            ]},
        ]},
        {"slug": "ssd", "name": "SSD", "url": _x("ssd"), "source": "xgear", "children": [
            {"slug": "ssd-250gb-256gb", "name": "250GB - 256GB", "url": _x("ssd-250gb-256gb"), "source": "xgear"},
            {"slug": "ssd-500gb-512gb", "name": "500GB - 512GB", "url": _x("ssd-500gb-512gb"), "source": "xgear"},
            {"slug": "ssd-1tb-2tb", "name": "1TB - 2TB", "url": _x("ssd-1tb-2tb"), "source": "xgear"},
            {"slug": "o-cung-di-dong", "name": "Ổ cứng di động", "url": _x("o-cung-di-dong"), "source": "xgear"},
        ]},
        {"slug": "hdd", "name": "HDD", "url": _x("hdd"), "source": "xgear", "children": [
            {"slug": "hdd-laptop", "name": "HDD Laptop", "url": _x("hdd-laptop"), "source": "xgear"},
            {"slug": "hdd-pc", "name": "HDD PC", "url": _x("hdd-pc"), "source": "xgear"},
        ]},
        {"slug": "nguon-psu", "name": "Nguồn máy tính", "url": _x("nguon-psu"), "source": "xgear", "children": [
            {"slug": "nguon-asus", "name": "Nguồn Asus", "url": _x("nguon-asus"), "source": "xgear"},
            {"slug": "nguon-cooler-master", "name": "Nguồn Cooler Master", "url": _x("nguon-cooler-master"), "source": "xgear"},
            {"slug": "nguon-corsair", "name": "Nguồn Corsair", "url": _x("nguon-corsair"), "source": "xgear"},
            {"slug": "nguon-deepcool", "name": "Nguồn Deepcool", "url": _x("nguon-deepcool"), "source": "xgear"},
            {"slug": "nguon-gigabyte", "name": "Nguồn Gigabyte", "url": _x("nguon-gigabyte"), "source": "xgear"},
            {"slug": "nguon-msi", "name": "Nguồn MSI", "url": _x("nguon-msi"), "source": "xgear"},
        ]},
        {"slug": "tan-nhiet-cpu", "name": "Tản nhiệt CPU", "url": _x("tan-nhiet-cpu"), "source": "xgear", "children": [
            {"slug": "tan-nhiet-asus", "name": "Tản nhiệt Asus", "url": _x("tan-nhiet-asus"), "source": "xgear"},
            {"slug": "tan-nhiet-cooler-master", "name": "Tản nhiệt Cooler Master", "url": _x("tan-nhiet-cooler-master"), "source": "xgear"},
            {"slug": "tan-nhiet-corsair", "name": "Tản nhiệt Corsair", "url": _x("tan-nhiet-corsair"), "source": "xgear"},
            {"slug": "tan-nhiet-deepcool", "name": "Tản nhiệt Deepcool", "url": _x("tan-nhiet-deepcool"), "source": "xgear"},
            {"slug": "tan-nhiet-gigabyte", "name": "Tản nhiệt Gigabyte", "url": _x("tan-nhiet-gigabyte"), "source": "xgear"},
            {"slug": "tan-nhiet-msi", "name": "Tản nhiệt MSI", "url": _x("tan-nhiet-msi"), "source": "xgear"},
        ]},
        {"slug": "case-may-tinh", "name": "Case máy tính", "url": _x("case-may-tinh"), "source": "xgear", "children": [
            {"slug": "case-mik", "name": "Case MIK", "url": _x("case-mik"), "source": "xgear"},
            {"slug": "case-deepcool", "name": "Case Deepcool", "url": _x("case-deepcool"), "source": "xgear"},
            {"slug": "case-cooler-master", "name": "Case Cooler Master", "url": _x("case-cooler-master"), "source": "xgear"},
            {"slug": "case-nzxt", "name": "Case NZXT", "url": _x("case-nzxt"), "source": "xgear"},
            {"slug": "case-msi", "name": "Case MSI", "url": _x("case-msi"), "source": "xgear"},
            {"slug": "case-hyte", "name": "Case HYTE", "url": _x("case-hyte"), "source": "xgear"},
            {"slug": "case-corsair", "name": "Case Corsair", "url": _x("case-corsair"), "source": "xgear"},
            {"slug": "case-asus", "name": "Case Asus", "url": _x("case-asus"), "source": "xgear"},
            {"slug": "case-gigabyte", "name": "Case Gigabyte", "url": _x("case-gigabyte"), "source": "xgear"},
            {"slug": "case-xigmatek", "name": "Case Xigmatek", "url": _x("case-xigmatek"), "source": "xgear"},
        ]},
        {"slug": "quat-case", "name": "Quạt Case", "url": _x("quat-case"), "source": "xgear", "children": [
            {"slug": "quat-deepcool", "name": "Quạt Deepcool", "url": _x("quat-deepcool"), "source": "xgear"},
            {"slug": "quat-xigmatek", "name": "Quạt Xigmatek", "url": _x("quat-xigmatek"), "source": "xgear"},
        ]},
        {"slug": "vga", "name": "VGA", "url": _x("vga"), "source": "xgear"},
    ]},
    {"slug": "gaming-gear", "name": "Gaming Gear", "url": _x("gaming-gear"), "source": "xgear", "level": 1, "children": [
        {"slug": "ban-phim-may-tinh", "name": "Bàn phím", "url": _x("ban-phim"), "source": "xgear"},
        {"slug": "chuot-may-tinh", "name": "Chuột", "url": _x("chuot-may-tinh"), "source": "xgear"},
        {"slug": "tai-nghe-may-tinh", "name": "Tai nghe", "url": _x("tai-nghe"), "source": "xgear"},
        {"slug": "lot-chuot", "name": "Lót chuột", "url": _x("lot-chuot"), "source": "xgear"},
        {"slug": "microphone", "name": "Microphone", "url": _x("microphone"), "source": "xgear"},
        {"slug": "loa", "name": "Loa", "url": _x("loa"), "source": "xgear"},
        {"slug": "tay-cam", "name": "Tay cầm", "url": _x("tay-cam"), "source": "xgear"},
        {"slug": "webcam", "name": "Webcam", "url": _x("webcam"), "source": "xgear"},
        {"slug": "dia-choi-game", "name": "Đĩa chơi game", "url": _x("dia-choi-game"), "source": "xgear"},
    ]},
    {"slug": "phu-kien", "name": "Phụ kiện", "url": _x("phu-kien"), "source": "xgear", "level": 1, "children": [
        {"slug": "balo-tui-xach", "name": "Balo", "url": _x("balo-tui-xach"), "source": "xgear"},
        {"slug": "phu-kien-pc", "name": "Phụ kiện PC", "url": _x("phu-kien-pc"), "source": "xgear"},
        {"slug": "thiet-bi-mang", "name": "Thiết bị mạng", "url": _x("thiet-bi-mang"), "source": "xgear"},
    ]},
    {"slug": "ban-ghe", "name": "Bàn - Ghế", "url": _g("ghe-gia-tot"), "source": "gearvn", "level": 1, "children": [
        {"slug": "ghe-gia-tot", "name": "Ghế giá tốt", "url": _g("ghe-gia-tot"), "source": "gearvn"},
        {"slug": "ghe-cong-thai-hoc", "name": "Ghế công thái học", "url": _g("ghe-cong-thai-hoc"), "source": "gearvn"},
        {"slug": "ban-gaming", "name": "Bàn Gaming", "url": _g("ban-gaming"), "source": "gearvn"},
        {"slug": "ban-cong-thai-hoc", "name": "Bàn Công Thái Học", "url": _g("ban-cong-thai-hoc"), "source": "gearvn"},
    ]},
]


def flatten_tree(
    nodes: List[Dict], parent_id: str | None = None, level: int = 1
) -> List[Dict[str, Any]]:
    """Flatten cây thành danh sách categories với category_id (slug), parent_id, level."""
    result: List[Dict[str, Any]] = []
    for node in nodes:
        slug = node["slug"]
        name = node.get("name", slug)
        url = node.get("url", "")
        source = node.get("source", "xgear")
        result.append({
            "category_id": slug,
            "parent_id": parent_id,
            "level": level,
            "name": name,
            "slug": slug,
            "source_url": url,
            "source": source,
        })
        children = node.get("children", [])
        if children:
            result.extend(flatten_tree(children, parent_id=slug, level=level + 1))
    return result


def get_flat_categories() -> List[Dict[str, Any]]:
    """Trả về danh sách categories phẳng (dùng cho MongoDB)."""
    return flatten_tree(CATEGORY_TREE)


def get_scrape_urls() -> List[tuple[str, str, str]]:
    """Trả về (slug, url, source) cho tất cả node có URL (để cào products)."""
    flat = get_flat_categories()
    return [(c["slug"], c["source_url"], c["source"]) for c in flat if c.get("source_url")]
