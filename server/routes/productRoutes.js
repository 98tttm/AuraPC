const express = require('express');
const Product = require('../models/Product');
const Category = require('../models/Category');

const router = express.Router();

/**
 * Trả về mảng [category_id/slug] (string) gồm bản thân + mọi danh mục con để lọc sản phẩm.
 * Hỗ trợ cả schema mới (category_id string) và cũ (_id số).
 */
async function getCategoryIdsIncludingDescendants(categoryParam) {
  const str = typeof categoryParam === 'string' ? categoryParam.trim() : String(categoryParam);
  const catNum = parseInt(str, 10);
  const isNumeric = !Number.isNaN(catNum) && str === String(catNum);
  const cat = await Category.findOne(
    isNumeric
      ? { $or: [{ _id: catNum }, { category_id: str }, { slug: str }] }
      : { $or: [{ category_id: str }, { slug: str }, { _id: str }] }
  ).lean();
  if (!cat) return isNumeric ? [catNum] : [];
  const idKey = cat.category_id || cat.slug || cat._id;
  const ids = [idKey];
  const parentRef = cat.category_id || cat.slug || cat._id;
  const children = await Category.find({ parent_id: parentRef })
    .select('category_id slug _id')
    .lean();
  children.forEach((c) => {
    const kid = c.category_id || c.slug || c._id;
    if (kid != null && !ids.includes(kid)) ids.push(kid);
  });
  return ids;
}

/** Resolve category { _id, category_id, name, slug } từ category_id hoặc primaryCategoryId hoặc category. */
async function resolveCategoryForProducts(items) {
  const ids = new Set();
  items.forEach((p) => {
    const id = p.category_id ?? p.primaryCategoryId ?? p.category;
    if (id != null && id !== '') ids.add(String(id));
  });
  if (ids.size === 0) return items;
  const idList = Array.from(ids);
  const categories = await Category.find({
    $or: [
      { _id: { $in: idList } },
      { category_id: { $in: idList } },
      { slug: { $in: idList } },
    ],
  })
    .select('_id category_id name slug')
    .lean();
  const byId = new Map();
  categories.forEach((c) => {
    const k1 = c.category_id || c.slug || String(c._id);
    byId.set(k1, c);
    if (c._id != null) byId.set(String(c._id), c);
  });
  return items.map((p) => {
    const id = p.category_id ?? p.primaryCategoryId ?? p.category;
    const key = id != null ? String(id) : null;
    const cat = key ? byId.get(key) : null;
    const out = { ...p };
    out.category = cat ? { _id: cat._id, category_id: cat.category_id, name: cat.name, slug: cat.slug } : null;
    return out;
  });
}

/** Chuẩn hóa product cho UI: images[] string, ẩn source/url theo đặc tả. */
function normalizeProductForUI(p) {
  if (!p) return p;
  const out = { ...p };
  if (Array.isArray(out.images)) {
    out.images = out.images.map((img) => (typeof img === 'string' ? img : img?.url || ''));
  } else if (out.images && typeof out.images === 'object' && !Array.isArray(out.images)) {
    out.images = [];
  }
  delete out.source;
  delete out.url;
  return out;
}

/** Build sort object from query: featured | price_asc | price_desc | name_asc | name_desc | newest | best_seller */
function getSort(sortQuery) {
  switch (sortQuery) {
    case 'price_asc':
      return { price: 1, createdAt: -1 };
    case 'price_desc':
      return { price: -1, createdAt: -1 };
    case 'name_asc':
      return { name: 1 };
    case 'name_desc':
      return { name: -1 };
    case 'newest':
      return { createdAt: -1 };
    case 'best_seller':
      return { featured: -1, createdAt: -1 };
    case 'featured':
    default:
      return { featured: -1, createdAt: -1 };
  }
}

router.get('/', async (req, res) => {
  try {
    const {
      category,
      search,
      featured,
      page = 1,
      limit = 12,
      brand,
      minPrice,
      maxPrice,
      sort,
      cpu,
      gpu,
      screenInch,
      storage,
      ram,
      // CPU chi tiết
      cpuSeries,
      cpuSocket,
      cpuCores,
      // Mainboard
      mbSocket,
      mbRamType,
      mbChipset,
      // RAM
      ramType,
      ramCapacity,
      ramBus,
      // SSD
      ssdCapacity,
      ssdInterface,
      ssdForm,
      // VGA
      vgaSeries,
      vram,
      // Bàn phím
      kbSwitch,
      kbLayout,
      kbConnection,
      // Chuột
      mouseDpi,
      mouseWeight,
      mouseConnection,
    } = req.query;
    const filter = { $and: [{ $or: [{ active: true }, { active: { $exists: false } }] }] };
    if (category) {
      const categoryIds = await getCategoryIdsIncludingDescendants(category);
      if (categoryIds.length > 0) {
        const hasString = categoryIds.some((id) => typeof id === 'string');
        if (hasString) {
          filter.$and.push({
            $or: [
              { category_id: { $in: categoryIds } },
              { category_ids: { $in: categoryIds } },
            ],
          });
        } else {
          filter.$and.push({
            $or: [
              { primaryCategoryId: { $in: categoryIds } },
              { category: { $in: categoryIds } },
              { categoryIds: { $in: categoryIds } },
            ],
          });
        }
      }
    }
    if (featured === 'true') filter.$and.push({ featured: true });
    // Helper: chuyển query (string/array/csv) thành mảng string.
    function toArray(val) {
      if (!val) return [];
      if (Array.isArray(val)) {
        return val.map((s) => String(s).trim()).filter((s) => !!s);
      }
      return String(val)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => !!s);
    }
    // Hãng sản xuất: tìm theo brand HOẶC tên sản phẩm chứa tên hãng (ASUS, GIGABYTE, MSI)
    const brandList = toArray(brand);
    if (brandList.length) {
      filter.$and.push({
        $or: brandList.flatMap((b) => {
          const esc = String(b).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(esc, 'i');
          return [
            { brand: re },
            { name: re },
            { shortDescription: re },
          ];
        }),
      });
    }
    if (minPrice != null && minPrice !== '') {
      const n = parseFloat(minPrice);
      if (!Number.isNaN(n)) {
        filter.$and.push({
          $or: [
            { salePrice: { $gte: n } },
            { $and: [{ $or: [{ salePrice: null }, { salePrice: 0 }] }, { price: { $gte: n } }] },
          ],
        });
      }
    }
    if (maxPrice != null && maxPrice !== '') {
      const n = parseFloat(maxPrice);
      if (!Number.isNaN(n)) {
        filter.$and.push({
          $or: [
            { salePrice: { $lte: n } },
            { $and: [{ $or: [{ salePrice: null }, { salePrice: 0 }] }, { price: { $lte: n } }] },
          ],
        });
      }
    }
    if (search && search.trim()) {
      filter.$and.push({
        $or: [
          { name: new RegExp(search.trim(), 'i') },
          { shortDescription: new RegExp(search.trim(), 'i') },
        ],
      });
    }
    function esc(s) {
      return String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    if (cpu && String(cpu).trim()) {
      const val = esc(cpu);
      filter.$and.push({
        $or: [
          { 'specs.CPU': new RegExp(val, 'i') },
          { 'techSpecs.CPU': new RegExp(val, 'i') },
        ],
      });
    }
    if (gpu && String(gpu).trim()) {
      const val = esc(gpu);
      filter.$and.push({
        $or: [
          { 'specs.Card đồ họa': new RegExp(val, 'i') },
          { 'specs.GPU': new RegExp(val, 'i') },
          { 'specs.VGA': new RegExp(val, 'i') },
          { 'techSpecs.Card đồ họa': new RegExp(val, 'i') },
          { 'techSpecs.GPU': new RegExp(val, 'i') },
          { 'techSpecs.VGA': new RegExp(val, 'i') },
        ],
      });
    }
    if (screenInch && String(screenInch).trim()) {
      const val = esc(screenInch);
      filter.$and.push({
        $or: [
          { 'specs.Màn hình': new RegExp(val, 'i') },
          { 'specs.Kích thước màn hình': new RegExp(val, 'i') },
          { 'techSpecs.Màn hình': new RegExp(val, 'i') },
          { 'techSpecs.Kích thước màn hình': new RegExp(val, 'i') },
        ],
      });
    }
    if (storage && String(storage).trim()) {
      const val = esc(storage);
      filter.$and.push({
        $or: [
          { 'specs.Ổ cứng': new RegExp(val, 'i') },
          { 'specs.Ổ cứng': new RegExp(val, 'i') },
          { 'specs.SSD': new RegExp(val, 'i') },
          { 'techSpecs.Ổ cứng': new RegExp(val, 'i') },
          { 'techSpecs.SSD': new RegExp(val, 'i') },
        ],
      });
    }
    if (ram && String(ram).trim()) {
      const val = esc(ram);
      filter.$and.push({
        $or: [
          { 'specs.RAM': new RegExp(val, 'i') },
          { 'techSpecs.RAM': new RegExp(val, 'i') },
        ],
      });
    }
    // CPU chi tiết: series (i3/i5/Ryzen 5/...), socket (AM4/AM5/LGA1700...), nhóm số nhân (4/6/8+)
    if (cpuSeries && String(cpuSeries).trim()) {
      const val = esc(cpuSeries);
      filter.$and.push({
        $or: [
          { 'specs.CPU': new RegExp(val, 'i') },
          { 'specs.Dòng CPU': new RegExp(val, 'i') },
          { 'techSpecs.CPU': new RegExp(val, 'i') },
          { 'techSpecs.Dòng CPU': new RegExp(val, 'i') },
        ],
      });
    }
    if (cpuSocket && String(cpuSocket).trim()) {
      const val = esc(cpuSocket);
      filter.$and.push({
        $or: [
          { 'specs.Socket': new RegExp(val, 'i') },
          { 'specs.Kiến trúc': new RegExp(val, 'i') },
          { 'techSpecs.Socket': new RegExp(val, 'i') },
          { 'techSpecs.Kiến trúc': new RegExp(val, 'i') },
        ],
      });
    }
    if (cpuCores && String(cpuCores).trim()) {
      const val = esc(cpuCores);
      filter.$and.push({
        $or: [
          { 'specs.Số nhân': new RegExp(val, 'i') },
          { 'specs.Số nhân xử lý': new RegExp(val, 'i') },
          { 'specs.Số nhân (Cores)': new RegExp(val, 'i') },
          { 'techSpecs.Số nhân': new RegExp(val, 'i') },
          { 'techSpecs.Số nhân xử lý': new RegExp(val, 'i') },
          { 'techSpecs.Số nhân (Cores)': new RegExp(val, 'i') },
        ],
      });
    }
    // Mainboard: socket CPU, chuẩn RAM, chipset
    if (mbSocket && String(mbSocket).trim()) {
      const val = esc(mbSocket);
      filter.$and.push({
        $or: [
          { 'specs.CPU': new RegExp(val, 'i') },
          { 'specs.PROROCESSOR': new RegExp(val, 'i') },
          { 'techSpecs.CPU': new RegExp(val, 'i') },
          { 'techSpecs.PROROCESSOR': new RegExp(val, 'i') },
        ],
      });
    }
    if (mbRamType && String(mbRamType).trim()) {
      const val = esc(mbRamType);
      filter.$and.push({
        $or: [
          { 'specs.MEMORY': new RegExp(val, 'i') },
          { 'specs.Memory': new RegExp(val, 'i') },
          { 'techSpecs.MEMORY': new RegExp(val, 'i') },
          { 'techSpecs.Memory': new RegExp(val, 'i') },
        ],
      });
    }
    if (mbChipset && String(mbChipset).trim()) {
      const val = esc(mbChipset);
      filter.$and.push({
        $or: [
          { 'specs.CHIPSET': new RegExp(val, 'i') },
          { 'specs.Chipset': new RegExp(val, 'i') },
          { 'techSpecs.CHIPSET': new RegExp(val, 'i') },
          { 'techSpecs.Chipset': new RegExp(val, 'i') },
        ],
      });
    }
    // RAM: type (DDR4/DDR5), capacity, bus
    if (ramType && String(ramType).trim()) {
      const val = esc(ramType);
      filter.$and.push({
        $or: [
          { 'specs.Chuẩn Ram': new RegExp(val, 'i') },
          { 'specs.Chuẩn RAM': new RegExp(val, 'i') },
          { 'techSpecs.Chuẩn Ram': new RegExp(val, 'i') },
          { 'techSpecs.Chuẩn RAM': new RegExp(val, 'i') },
        ],
      });
    }
    if (ramCapacity && String(ramCapacity).trim()) {
      const val = esc(ramCapacity);
      filter.$and.push({
        $or: [
          { 'specs.Dung lượng': new RegExp(val, 'i') },
          { 'techSpecs.Dung lượng': new RegExp(val, 'i') },
        ],
      });
    }
    if (ramBus && String(ramBus).trim()) {
      const val = esc(ramBus);
      filter.$and.push({
        $or: [
          { 'specs.Bus hỗ trợ': new RegExp(val, 'i') },
          { 'specs.Tốc độ SPD': new RegExp(val, 'i') },
          { 'specs.Tốc độ': new RegExp(val, 'i') },
          { 'techSpecs.Bus hỗ trợ': new RegExp(val, 'i') },
          { 'techSpecs.Tốc độ SPD': new RegExp(val, 'i') },
          { 'techSpecs.Tốc độ': new RegExp(val, 'i') },
        ],
      });
    }
    // SSD: capacity, interface, form factor
    if (ssdCapacity && String(ssdCapacity).trim()) {
      const val = esc(ssdCapacity);
      filter.$and.push({
        $or: [
          { 'specs.Dung lượng': new RegExp(val, 'i') },
          { 'techSpecs.Dung lượng': new RegExp(val, 'i') },
        ],
      });
    }
    if (ssdInterface && String(ssdInterface).trim()) {
      const val = esc(ssdInterface);
      filter.$and.push({
        $or: [
          { 'specs.Chuẩn giao tiếp': new RegExp(val, 'i') },
          { 'specs.Giao tiếp': new RegExp(val, 'i') },
          { 'techSpecs.Chuẩn giao tiếp': new RegExp(val, 'i') },
          { 'techSpecs.Giao tiếp': new RegExp(val, 'i') },
        ],
      });
    }
    if (ssdForm && String(ssdForm).trim()) {
      const val = esc(ssdForm);
      filter.$and.push({
        $or: [
          { 'specs.Kích thước / Loại:': new RegExp(val, 'i') },
          { 'specs.Phân loại': new RegExp(val, 'i') },
          { 'techSpecs.Kích thước / Loại:': new RegExp(val, 'i') },
          { 'techSpecs.Phân loại': new RegExp(val, 'i') },
        ],
      });
    }
    // VGA: series (RTX 4060, RX 7800...) và VRAM
    // Rút gọn để match linh hoạt: "NVIDIA GeForce RTX 5060 (Blackwell)" -> dùng cả full string và "RTX 5060"
    if (vgaSeries && String(vgaSeries).trim()) {
      const raw = String(vgaSeries).trim();
      const val = esc(raw);
      const coreMatch = raw.match(/(?:RTX|GTX|RX)\s*\d{3,5}(?:\s*XT)?/i);
      const searchTerms = [val];
      if (coreMatch && coreMatch[0] !== raw) searchTerms.push(esc(coreMatch[0]));
      const specKeys = ['Graphics Processing', 'Chipset', 'Card đồ họa', 'GPU', 'VGA'];
      const orConditions = [];
      for (const term of searchTerms) {
        for (const key of specKeys) {
          orConditions.push({ [`specs.${key}`]: new RegExp(term, 'i') });
          orConditions.push({ [`techSpecs.${key}`]: new RegExp(term, 'i') });
        }
      }
      filter.$and.push({ $or: orConditions });
    }
    if (vram && String(vram).trim()) {
      const raw = String(vram).trim();
      const val = esc(raw);
      // Hỗ trợ "8GB" và "8 GB": dùng pattern \d+\s*GB để match linh hoạt
      const flexMatch = raw.match(/^(\d+)\s*GB$/i);
      const flexPattern = flexMatch ? flexMatch[1] + '\\s*GB' : val;
      const patterns = flexMatch ? [val, flexPattern] : [val];
      const orConditions = [];
      const vramKeys = ['Memory Size', 'VRAM', 'Dung lượng bộ nhớ', 'Bộ nhớ'];
      for (const p of patterns) {
        for (const key of vramKeys) {
          orConditions.push({ [`specs.${key}`]: new RegExp(p, 'i') });
          orConditions.push({ [`techSpecs.${key}`]: new RegExp(p, 'i') });
        }
      }
      filter.$and.push({ $or: orConditions });
    }
    // Bàn phím: switch, layout, kết nối
    if (kbSwitch && String(kbSwitch).trim()) {
      const val = esc(kbSwitch);
      filter.$and.push({
        $or: [
          { 'specs.Kiểu Switch': new RegExp(val, 'i') },
          { 'specs.Switch': new RegExp(val, 'i') },
          { 'techSpecs.Kiểu Switch': new RegExp(val, 'i') },
          { 'techSpecs.Switch': new RegExp(val, 'i') },
        ],
      });
    }
    if (kbLayout && String(kbLayout).trim()) {
      const val = esc(kbLayout);
      filter.$and.push({
        $or: [
          { 'specs.Kích thước/Layout': new RegExp(val, 'i') },
          { 'specs.Layout': new RegExp(val, 'i') },
          { 'techSpecs.Kích thước/Layout': new RegExp(val, 'i') },
          { 'techSpecs.Layout': new RegExp(val, 'i') },
        ],
      });
    }
    if (kbConnection && String(kbConnection).trim()) {
      const val = esc(kbConnection);
      filter.$and.push({
        $or: [
          { 'specs.Phương thức kết nối': new RegExp(val, 'i') },
          { 'specs.Kết nối': new RegExp(val, 'i') },
          { 'techSpecs.Phương thức kết nối': new RegExp(val, 'i') },
          { 'techSpecs.Kết nối': new RegExp(val, 'i') },
        ],
      });
    }
    // Chuột: DPI, trọng lượng, kết nối
    if (mouseDpi && String(mouseDpi).trim()) {
      const val = esc(mouseDpi);
      filter.$and.push({
        $or: [
          { 'specs.DPI': new RegExp(val, 'i') },
          { 'specs.Độ nhạy (DPI)': new RegExp(val, 'i') },
          { 'techSpecs.DPI': new RegExp(val, 'i') },
          { 'techSpecs.Độ nhạy (DPI)': new RegExp(val, 'i') },
        ],
      });
    }
    if (mouseWeight && String(mouseWeight).trim()) {
      const val = esc(mouseWeight);
      filter.$and.push({
        $or: [
          { 'specs.Trọng lượng': new RegExp(val, 'i') },
          { 'techSpecs.Trọng lượng': new RegExp(val, 'i') },
        ],
      });
    }
    if (mouseConnection && String(mouseConnection).trim()) {
      const val = esc(mouseConnection);
      filter.$and.push({
        $or: [
          { 'specs.Chuẩn kết nối': new RegExp(val, 'i') },
          { 'specs.Kết nối': new RegExp(val, 'i') },
          { 'techSpecs.Chuẩn kết nối': new RegExp(val, 'i') },
          { 'techSpecs.Kết nối': new RegExp(val, 'i') },
        ],
      });
    }
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, parseInt(limit, 10) || 12);
    const limitNum = Math.min(50, parseInt(limit, 10) || 12);
    const sortObj = getSort(sort);
    const [rawItems, total] = await Promise.all([
      Product.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);
    const resolved = await resolveCategoryForProducts(rawItems);
    const items = resolved.map(normalizeProductForUI);
    res.json({ items, total, page: parseInt(page, 10), limit: limitNum });
  } catch (err) {
    console.error('[GET /api/products]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────────────────────────────────────────────────────
 *  Normalizer helpers for filter-options
 * ─────────────────────────────────────────────────────────────── */

/** Known PC-component brands extracted from product names. */
const KNOWN_BRANDS = [
  'ASUS', 'GIGABYTE', 'MSI', 'CORSAIR', 'NZXT', 'DEEPCOOL', 'COOLER MASTER',
  'THERMALTAKE', 'LIAN LI', 'BE QUIET', 'NOCTUA', 'ARCTIC', 'RAZER',
  'LOGITECH', 'KINGSTON', 'SAMSUNG', 'WESTERN DIGITAL', 'WD', 'SEAGATE',
  'CRUCIAL', 'G.SKILL', 'TEAMGROUP', 'TEAM', 'GEIL', 'PATRIOT',
  'SAPPHIRE', 'POWERCOLOR', 'XFX', 'ZOTAC', 'INNO3D', 'COLORFUL',
  'GALAX', 'PNY', 'EVGA', 'PALIT', 'SEASONIC', 'FSP', 'XIGMATEK',
  'SEGOTEP', 'SILVERSTONE', 'COUGAR', 'HYTE', 'PHANTEKS',
  'INTEL', 'AMD', 'AKKO', 'KEYCHRON', 'MONSGEEK', 'DUCKY',
  'STEELSERIES', 'HYPERX', 'HP', 'DELL', 'LENOVO', 'ACER', 'LG',
  'VIEWSONIC', 'AOC', 'BENQ', 'ADATA',
];

/** Extract brand from product name by matching known brands. */
function extractBrandFromName(name) {
  if (!name) return null;
  const upper = name.toUpperCase();
  for (const b of KNOWN_BRANDS) {
    // Match brand at start, or after common prefixes like "VGA ", "Card ", etc.
    if (upper.startsWith(b + ' ') || upper.startsWith(b + '-') ||
      upper.includes(' ' + b + ' ') || upper.includes('/' + b + ' ') ||
      upper.startsWith('VGA ' + b) || upper.startsWith('CPU ' + b) ||
      upper.startsWith('RAM ' + b) || upper.startsWith('SSD ' + b) ||
      upper.startsWith('PSU ' + b) || upper.startsWith('CARD ') && upper.includes(b)) {
      return KNOWN_BRANDS.find(kb => kb === b); // preserves original casing
    }
  }
  return null;
}

/** Extract GPU chip name from verbose spec string. e.g. "NVIDIA GeForce RTX 5060 (Blackwell)" → "GeForce RTX 5060" */
function normalizeGpuChip(val) {
  if (!val) return null;
  // Match RTX/GTX/RX series with optional Ti/XT/SUPER/OC suffix
  const m = val.match(/(?:GeForce\s+)?((?:RTX|GTX)\s*\d{3,5}(?:\s*(?:Ti|SUPER))?)/i);
  if (m) return 'GeForce ' + m[1].replace(/\s+/g, ' ').trim();
  const amd = val.match(/((?:Radeon\s+)?RX\s*\d{3,5}(?:\s*XT)?)/i);
  if (amd) return amd[1].replace(/\s+/g, ' ').trim();
  return null;
}

/** Extract VRAM amount. "8GB GDDR6" → "8GB", "12 GB GDDR7" → "12GB" */
function normalizeVram(val) {
  if (!val) return null;
  const m = val.match(/(\d+)\s*GB/i);
  return m ? m[1] + 'GB' : null;
}

/** Extract CPU socket. "AMD Socket AM5 for..." → "AM5", "LGA1700 socket..." → "LGA1700" */
function normalizeSocket(val) {
  if (!val) return null;
  const m = val.match(/(AM[45]|LGA\s*1[78]\d{2}|FCLGA\s*1[78]\d{2}|sTR5)/i);
  if (m) {
    const s = m[1].replace(/\s+/g, '').toUpperCase();
    // Normalize FCLGA → LGA
    return s.replace(/^FCLGA/, 'LGA');
  }
  return null;
}

/** Extract short CPU series. "Intel Core i5-14400F ..." → "Core i5-14400F" */
function normalizeCpuSeries(val) {
  if (!val) return null;
  // Intel Core Ultra
  let m = val.match(/(Core\s+Ultra\s+\d+\s+\d+\w*)/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  // Intel Core i3/i5/i7/i9
  m = val.match(/(Core\s+i[3579]-?\d{4,5}\w*)/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  // AMD Ryzen AI
  m = val.match(/(Ryzen\s+AI\s+\d+\s+\d+\w*)/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  // AMD Ryzen 5/7/9
  m = val.match(/(Ryzen\s+[3579]\s+\d{3,5}\w*)/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  // AMD Athlon
  m = val.match(/(Athlon\s*\w*)/i);
  if (m) return m[1].trim();
  return null;
}

/** Extract chipset. "Intel® B760 Express Chipset" → "B760", "AMD B650" → "B650" */
function normalizeChipset(val) {
  if (!val) return null;
  const m = val.match(/\b([ABHXZ]\d{3,4}[EM]?)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/** Normalize RAM type. "DDR5 SoDIMM" → "DDR5", "4 x DDR4..." → "DDR4" */
function normalizeRamType(val) {
  if (!val) return null;
  const m = val.match(/(DDR[45])/i);
  return m ? m[1].toUpperCase() : null;
}

/** Normalize capacity for RAM/SSD. "16GB (2x8GB)" → "16GB", "1TB" → "1TB" */
function normalizeCapacity(val) {
  if (!val) return null;
  // Try TB first
  const tb = val.match(/(\d+)\s*TB/i);
  if (tb) return tb[1] + 'TB';
  // Then GB
  const gb = val.match(/(\d+)\s*GB/i);
  if (gb) {
    const num = parseInt(gb[1], 10);
    // Filter out unreasonable values for RAM (stick: 4-128GB) and SSD (64GB-8TB)
    if (num >= 4 && num <= 8192) return num + 'GB';
  }
  return null;
}

/** Normalize RAM bus speed. "5600 MHz" → "5600MHz", "4800 MT/s" → "4800MHz" */
function normalizeRamBus(val) {
  if (!val) return null;
  const m = val.match(/(\d{4,5})\s*(?:MHz|MT\/s|Mhz)/i);
  return m ? m[1] + 'MHz' : null;
}

/** Normalize SSD interface. "PCIe Gen 5.0 x4, NVMe 2.0" → "PCIe 5.0 NVMe" */
function normalizeSsdInterface(val) {
  if (!val) return null;
  if (/SATA/i.test(val)) return 'SATA III';
  const pcie = val.match(/PCIe?\s*(?:Gen\s*)?(\d)\.?\d?/i);
  if (pcie) {
    const hasNvme = /NVMe/i.test(val);
    return `PCIe ${pcie[1]}.0${hasNvme ? ' NVMe' : ''}`;
  }
  if (/NVMe/i.test(val)) return 'NVMe';
  return null;
}

/** Normalize SSD form factor. */
function normalizeSsdForm(val) {
  if (!val) return null;
  if (/M\.?2\s*2280/i.test(val) || /M\.?2/i.test(val)) return 'M.2';
  if (/2\.5/i.test(val)) return '2.5"';
  if (/3\.5/i.test(val)) return '3.5"';
  return null;
}

/** Normalize keyboard layout. Extract % or key count. */
function normalizeKbLayout(val) {
  if (!val) return null;
  // Percentage layouts
  if (/\b60\s*%/i.test(val)) return '60%';
  if (/\b65\s*%/i.test(val)) return '65%';
  if (/\b75\s*%/i.test(val)) return '75%';
  if (/\bTKL|80\s*%|87\s*phím|tenkeyless/i.test(val)) return 'TKL (80%)';
  if (/\b96\s*%|96\s*phím|97\s*phím|98\s*phím/i.test(val)) return '96%';
  if (/full\s*size|100\s*%|104\s*phím|108\s*phím/i.test(val)) return 'Full-size';
  return null;
}

/** Normalize connection type. */
function normalizeConnection(val) {
  if (!val) return null;
  const results = [];
  if (/có dây|wired|USB(?:\s+Type)?(?:-[AC])?\s*(?:có dây)?/i.test(val) && !/không dây|wireless/i.test(val)) results.push('Có dây');
  if (/2\.4\s*G(?:Hz)?|wireless|không dây/i.test(val)) results.push('Wireless 2.4GHz');
  if (/bluetooth/i.test(val)) results.push('Bluetooth');
  if (/LIGHTSPEED|HyperSpeed|SpeedNova/i.test(val)) results.push('Wireless 2.4GHz');
  if (results.length === 0 && /USB/i.test(val)) results.push('Có dây');
  return results.length > 0 ? results : null;
}

/** Normalize mouse DPI. Extract max DPI number. */
function normalizeMouseDpi(val) {
  if (!val) return null;
  const nums = val.match(/(\d[\d,]*)\s*(?:DPI|dpi)/g);
  if (nums && nums.length > 0) {
    // Get the largest DPI value
    const values = nums.map(n => parseInt(n.replace(/[^\d]/g, ''), 10)).filter(n => n > 100);
    if (values.length > 0) {
      const max = Math.max(...values);
      return max.toLocaleString('en-US') + ' DPI';
    }
  }
  // Try plain number
  const m = val.match(/(\d[\d,]+)/);
  if (m) {
    const n = parseInt(m[1].replace(/,/g, ''), 10);
    if (n >= 400 && n <= 50000) return n.toLocaleString('en-US') + ' DPI';
  }
  return null;
}

/* ───────────────────────────────────────────────────────────────
 *  Per-category filter extraction config
 *  Only extract filters RELEVANT to each category.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Define which filters to extract per category slug.
 * Key = builder step category slug.
 * Value = array of { target, keys, normalize } objects.
 */
const CATEGORY_FILTER_MAP = {
  'vga': [
    { target: 'vgaSeries', keys: ['Graphics Processing', 'Chipset', 'Card đồ họa', 'GPU', 'VGA'], normalize: normalizeGpuChip },
    { target: 'vram', keys: ['Memory Size', 'VRAM', 'Dung lượng bộ nhớ', 'Bộ nhớ'], normalize: normalizeVram },
  ],
  'cpu': [
    { target: 'cpuSeries', keys: ['Dòng CPU', 'CPU', 'Tên gọi', 'Model'], normalize: normalizeCpuSeries },
    { target: 'cpuSocket', keys: ['Socket', 'Kiến trúc'], normalize: normalizeSocket },
  ],
  'mainboard': [
    { target: 'mbSocket', keys: ['Socket', 'CPU', 'PROCESSOR'], normalize: normalizeSocket },
    { target: 'mbChipset', keys: ['CHIPSET', 'Chipset'], normalize: normalizeChipset },
    { target: 'mbRamType', keys: ['Chuẩn Ram', 'Chuẩn RAM', 'MEMORY', 'Hỗ trợ Ram'], normalize: normalizeRamType },
  ],
  'ram': [
    { target: 'ramType', keys: ['Chuẩn Ram', 'Chuẩn RAM', 'Loại'], normalize: normalizeRamType },
    { target: 'ramCapacity', keys: ['Dung lượng'], normalize: normalizeCapacity },
    { target: 'ramBus', keys: ['Bus hỗ trợ', 'Tốc độ SPD', 'Tốc độ', 'Bus'], normalize: normalizeRamBus },
  ],
  'ssd': [
    { target: 'ssdCapacity', keys: ['Dung lượng'], normalize: normalizeCapacity },
    { target: 'ssdInterface', keys: ['Chuẩn giao tiếp', 'Giao tiếp', 'Giao tiếp SSD'], normalize: normalizeSsdInterface },
    { target: 'ssdForm', keys: ['Kích thước / Loại:', 'Phân loại', 'Form'], normalize: normalizeSsdForm },
  ],
  'ban-phim-may-tinh': [
    { target: 'kbSwitch', keys: ['Kiểu Switch', 'Switch'], normalize: null /* keep raw — switch names are already clean */ },
    { target: 'kbLayout', keys: ['Kích thước/Layout', 'Layout', 'Kích thước'], normalize: normalizeKbLayout },
    { target: 'kbConnection', keys: ['Phương thức kết nối', 'Kết nối'], normalize: normalizeConnection },
  ],
  'chuot-may-tinh': [
    { target: 'mouseDpi', keys: ['DPI', 'Độ nhạy (DPI)'], normalize: normalizeMouseDpi },
    { target: 'mouseConnection', keys: ['Chuẩn kết nối', 'Kết nối'], normalize: normalizeConnection },
  ],
  'man-hinh': [
    {
      target: 'screenInch', keys: ['Màn hình', 'Kích thước màn hình', 'Kích thước'], normalize: (val) => {
        const m = val.match(/(\d+\.?\d*)\s*(?:"|'|\s*inch)/i);
        if (m) { const n = parseFloat(m[1]); if (n >= 13 && n <= 55) return n + '"'; }
        // Try just a number at the start
        const m2 = val.match(/^(\d+\.?\d*)/);
        if (m2) { const n = parseFloat(m2[1]); if (n >= 13 && n <= 55) return n + '"'; }
        return null;
      }
    },
  ],
};

/**
 * GET /api/products/filter-options
 * Returns clean, normalized filter values per-category.
 * Uses per-category configs to only extract relevant filters.
 */
router.get('/filter-options', async (req, res) => {
  try {
    const { category } = req.query;

    // Build filter giống GET /api/products
    const filter = { $and: [{ $or: [{ active: true }, { active: { $exists: false } }] }] };

    if (category) {
      const categoryIds = await getCategoryIdsIncludingDescendants(category);
      if (categoryIds.length > 0) {
        filter.$and.push({
          $or: [
            { category_id: { $in: categoryIds } },
            { category_ids: { $in: categoryIds } },
          ],
        });
      }
    }

    const products = await Product.find(filter).select('brand name specs techSpecs').lean();

    // ── Extract brands from product names (since brand field is often empty) ──
    const brandSet = new Set();
    for (const p of products) {
      // Try the brand field first
      const b = (p.brand || '').trim();
      if (b) brandSet.add(b);
      // Also try extracting from product name
      const fromName = extractBrandFromName(p.name);
      if (fromName) brandSet.add(fromName);
    }

    // ── Extract spec filters using per-category config ──
    const specSets = {};

    // Helper to read a spec value from a product
    const getSpec = (p, keys) => {
      for (const src of [p.specs, p.techSpecs]) {
        if (!src) continue;
        for (const k of keys) {
          const v = src[k];
          if (v != null && String(v).trim()) return String(v).trim();
        }
      }
      return null;
    };

    // Determine which filter config to use
    const catSlug = category ? String(category).trim() : null;
    const filterConfigs = catSlug ? (CATEGORY_FILTER_MAP[catSlug] || []) : [];

    // Initialize sets for each target
    for (const cfg of filterConfigs) {
      if (!specSets[cfg.target]) specSets[cfg.target] = new Set();
    }

    for (const p of products) {
      for (const cfg of filterConfigs) {
        const raw = getSpec(p, cfg.keys);
        if (!raw) continue;

        if (cfg.normalize) {
          const normalized = cfg.normalize(raw);
          if (normalized) {
            // normalizeConnection returns an array
            if (Array.isArray(normalized)) {
              normalized.forEach(v => specSets[cfg.target].add(v));
            } else {
              specSets[cfg.target].add(normalized);
            }
          }
        } else {
          // No normalizer — keep raw value (for things like switch names)
          specSets[cfg.target].add(raw);
        }
      }
    }

    // ── Build result ──
    const numericSort = (a, b) => {
      const numA = parseFloat(a.replace(/[^\d.]/g, ''));
      const numB = parseFloat(b.replace(/[^\d.]/g, ''));
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    };

    const NUMERIC_FIELDS = new Set([
      'vram', 'ramCapacity', 'ssdCapacity', 'ramBus', 'screenInch', 'mouseDpi',
    ]);

    const specs = {};
    // Always include all possible spec keys (even if empty) so frontend doesn't break
    const ALL_SPEC_KEYS = [
      'cpu', 'gpu', 'ram', 'storage', 'screenInch',
      'cpuSeries', 'cpuSocket', 'cpuCores',
      'mbSocket', 'mbRamType', 'mbChipset',
      'ramType', 'ramCapacity', 'ramBus',
      'ssdCapacity', 'ssdInterface', 'ssdForm',
      'vgaSeries', 'vram',
      'kbSwitch', 'kbLayout', 'kbConnection',
      'mouseDpi', 'mouseWeight', 'mouseConnection',
    ];

    for (const key of ALL_SPEC_KEYS) {
      const set = specSets[key];
      if (!set || set.size === 0) {
        specs[key] = [];
      } else {
        const arr = Array.from(set);
        specs[key] = NUMERIC_FIELDS.has(key) ? arr.sort(numericSort) : arr.sort();
      }
    }

    res.json({
      brands: Array.from(brandSet).sort(),
      specs,
      total: products.length,
    });
  } catch (err) {
    console.error('[GET /api/products/filter-options]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);
    const raw = await Product.find({
      $or: [{ active: true }, { active: { $exists: false } }],
      featured: true,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const resolved = await resolveCategoryForProducts(raw);
    const items = resolved.map(normalizeProductForUI);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/by-slug/:slug', async (req, res) => {
  try {
    const raw = await Product.findOne({
      slug: req.params.slug,
      $or: [{ active: true }, { active: { $exists: false } }],
    }).lean();
    if (!raw) return res.status(404).json({ error: 'Product not found' });
    const [resolved] = await resolveCategoryForProducts([raw]);
    const product = normalizeProductForUI(resolved);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const raw = await Product.findById(req.params.id).lean();
    if (!raw) return res.status(404).json({ error: 'Product not found' });
    const [resolved] = await resolveCategoryForProducts([raw]);
    const product = normalizeProductForUI(resolved);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
