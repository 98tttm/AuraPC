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
    const brandList = toArray(brand);
    if (brandList.length) {
      filter.$and.push({
        $or: brandList.map((b) => ({
          brand: new RegExp('^' + String(b).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
        })),
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
    if (vgaSeries && String(vgaSeries).trim()) {
      const val = esc(vgaSeries);
      filter.$and.push({
        $or: [
          { 'specs.Graphics Processing': new RegExp(val, 'i') },
          { 'specs.Chipset': new RegExp(val, 'i') },
          { 'techSpecs.Graphics Processing': new RegExp(val, 'i') },
          { 'techSpecs.Chipset': new RegExp(val, 'i') },
        ],
      });
    }
    if (vram && String(vram).trim()) {
      const val = esc(vram);
      filter.$and.push({
        $or: [
          { 'specs.Memory Size': new RegExp(val, 'i') },
          { 'techSpecs.Memory Size': new RegExp(val, 'i') },
        ],
      });
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

/**
 * GET /api/products/filter-options
 * Lấy tất cả các giá trị distinct cho bộ lọc từ TOÀN BỘ sản phẩm trong category.
 * Sử dụng MongoDB aggregation để tránh giới hạn 200 sản phẩm khi extract ở client.
 */
router.get('/filter-options', async (req, res) => {
  try {
    const { category } = req.query;

    // Build filter giống như GET /api/products
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

    // Aggregation pipeline để lấy distinct values
    const products = await Product.find(filter).select('brand specs techSpecs').lean();

    // Extract unique values
    const brands = new Set();
    const specValues = {
      // Laptop filters
      cpu: new Set(),
      gpu: new Set(),
      ram: new Set(),
      storage: new Set(),
      screenInch: new Set(),
      // CPU (Linh Kiện)
      cpuSeries: new Set(),
      cpuSocket: new Set(),
      cpuCores: new Set(),
      // Mainboard
      mbSocket: new Set(),
      mbRamType: new Set(),
      mbChipset: new Set(),
      // RAM (Linh Kiện)
      ramType: new Set(),
      ramCapacity: new Set(),
      ramBus: new Set(),
      // SSD
      ssdCapacity: new Set(),
      ssdInterface: new Set(),
      ssdForm: new Set(),
      // VGA
      vgaSeries: new Set(),
      vram: new Set(),
      // Keyboard
      kbSwitch: new Set(),
      kbLayout: new Set(),
      kbConnection: new Set(),
      // Mouse
      mouseDpi: new Set(),
      mouseWeight: new Set(),
      mouseConnection: new Set(),
    };

    // Helper để extract giá trị từ specs
    const getSpec = (p, keys) => {
      const spec = p.specs || p.techSpecs || {};
      for (const k of keys) {
        const v = spec[k];
        if (v != null && String(v).trim()) return String(v).trim();
      }
      return null;
    };

    // Helper để extract CPU labels (Intel, AMD Ryzen, AMD)
    const extractCpuLabels = (s) => {
      const out = [];
      if (/Intel/i.test(s)) out.push('Intel');
      if (/AMD\s*Ryzen/i.test(s)) out.push('AMD Ryzen');
      else if (/AMD/i.test(s)) out.push('AMD');
      return out;
    };

    // Helper để extract GPU labels
    const extractGpuLabels = (s) => {
      const out = [];
      if (/NVIDIA|GeForce|RTX|GTX/i.test(s)) out.push('NVIDIA');
      if (/AMD|Radeon/i.test(s)) out.push('AMD');
      if (/Intel.*(?:Arc|Iris|UHD|HD Graphics)/i.test(s)) out.push('Intel');
      return out;
    };

    // Helper để extract screen sizes
    const extractScreenInches = (s) => {
      const out = [];
      const re = /(\d+\.?\d*)\s*("|'|\s*inch)/gi;
      let m;
      while ((m = re.exec(s)) !== null) {
        const num = parseFloat(m[1]);
        if (num >= 10 && num <= 32) out.push(m[1]);
      }
      return [...new Set(out)];
    };

    // Helper để extract RAM GB
    const extractRamLabels = (s) => {
      const m = s.match(/(\d+)\s*GB/i);
      return m ? [m[1] + 'GB'] : [];
    };

    // Helper để extract storage
    const extractStorageLabels = (s) => {
      const out = [];
      const gb = s.match(/(\d+)\s*GB/i);
      if (gb) out.push(gb[1] + 'GB');
      const tb = s.match(/(\d+)\s*TB/i);
      if (tb) out.push(tb[1] + 'TB');
      return out;
    };

    for (const p of products) {
      // Brand
      if (p.brand && String(p.brand).trim()) {
        brands.add(String(p.brand).trim());
      }

      // Laptop: CPU
      const cpuVal = getSpec(p, ['CPU']);
      if (cpuVal) {
        extractCpuLabels(cpuVal).forEach(v => specValues.cpu.add(v));
      }

      // Laptop: GPU
      const gpuVal = getSpec(p, ['Card đồ họa', 'GPU', 'VGA']);
      if (gpuVal) {
        extractGpuLabels(gpuVal).forEach(v => specValues.gpu.add(v));
      }

      // Laptop: RAM
      const ramVal = getSpec(p, ['RAM']);
      if (ramVal) {
        extractRamLabels(ramVal).forEach(v => specValues.ram.add(v));
      }

      // Laptop: Storage
      const storageVal = getSpec(p, ['Ổ cứng', 'Ổ cứng', 'SSD']);
      if (storageVal) {
        extractStorageLabels(storageVal).forEach(v => specValues.storage.add(v));
      }

      // Laptop: Screen
      const screenVal = getSpec(p, ['Màn hình', 'Kích thước màn hình']);
      if (screenVal) {
        extractScreenInches(screenVal).forEach(v => specValues.screenInch.add(v));
      }

      // CPU (Component): Series, Socket, Cores
      const cpuSeriesVal = getSpec(p, ['Dòng CPU', 'CPU', 'Tên gọi', 'Model']);
      if (cpuSeriesVal) specValues.cpuSeries.add(cpuSeriesVal);
      const cpuSocketVal = getSpec(p, ['Socket', 'Kiến trúc']);
      if (cpuSocketVal) specValues.cpuSocket.add(cpuSocketVal);
      const cpuCoresVal = getSpec(p, ['Số nhân', 'Số nhân (Cores)', 'Số nhân xử lý']);
      if (cpuCoresVal) specValues.cpuCores.add(cpuCoresVal);

      // Mainboard
      const mbSocketVal = getSpec(p, ['Socket', 'CPU', 'PROCESSOR']);
      if (mbSocketVal) specValues.mbSocket.add(mbSocketVal);
      const mbRamTypeVal = getSpec(p, ['Chuẩn Ram', 'Chuẩn RAM', 'MEMORY', 'Hỗ trợ Ram']);
      if (mbRamTypeVal) specValues.mbRamType.add(mbRamTypeVal);
      const mbChipsetVal = getSpec(p, ['CHIPSET', 'Chipset']);
      if (mbChipsetVal) specValues.mbChipset.add(mbChipsetVal);

      // RAM (Component)
      const ramTypeVal = getSpec(p, ['Chuẩn Ram', 'Chuẩn RAM', 'Loại']);
      if (ramTypeVal) specValues.ramType.add(ramTypeVal);
      const ramCapacityVal = getSpec(p, ['Dung lượng']);
      if (ramCapacityVal) specValues.ramCapacity.add(ramCapacityVal);
      const ramBusVal = getSpec(p, ['Bus hỗ trợ', 'Tốc độ SPD', 'Tốc độ', 'Bus']);
      if (ramBusVal) specValues.ramBus.add(ramBusVal);

      // SSD
      const ssdCapacityVal = getSpec(p, ['Dung lượng']);
      if (ssdCapacityVal) specValues.ssdCapacity.add(ssdCapacityVal);
      const ssdInterfaceVal = getSpec(p, ['Chuẩn giao tiếp', 'Giao tiếp', 'Giao tiếp SSD']);
      if (ssdInterfaceVal) specValues.ssdInterface.add(ssdInterfaceVal);
      const ssdFormVal = getSpec(p, ['Kích thước / Loại:', 'Phân loại', 'Form']);
      if (ssdFormVal) specValues.ssdForm.add(ssdFormVal);

      // VGA
      const vgaSeriesVal = getSpec(p, ['Graphics Processing', 'Chipset', 'Card đồ họa', 'GPU', 'VGA']);
      if (vgaSeriesVal) specValues.vgaSeries.add(vgaSeriesVal);
      const vramVal = getSpec(p, ['Memory Size', 'VRAM', 'Dung lượng bộ nhớ']);
      if (vramVal) specValues.vram.add(vramVal);

      // Keyboard
      const kbSwitchVal = getSpec(p, ['Kiểu Switch', 'Switch']);
      if (kbSwitchVal) specValues.kbSwitch.add(kbSwitchVal);
      const kbLayoutVal = getSpec(p, ['Kích thước/Layout', 'Layout', 'Kích thước']);
      if (kbLayoutVal) specValues.kbLayout.add(kbLayoutVal);
      const kbConnectionVal = getSpec(p, ['Phương thức kết nối', 'Kết nối']);
      if (kbConnectionVal) specValues.kbConnection.add(kbConnectionVal);

      // Mouse
      const mouseDpiVal = getSpec(p, ['DPI', 'Độ nhạy (DPI)']);
      if (mouseDpiVal) specValues.mouseDpi.add(mouseDpiVal);
      const mouseWeightVal = getSpec(p, ['Trọng lượng']);
      if (mouseWeightVal) specValues.mouseWeight.add(mouseWeightVal);
      const mouseConnectionVal = getSpec(p, ['Chuẩn kết nối', 'Kết nối']);
      if (mouseConnectionVal) specValues.mouseConnection.add(mouseConnectionVal);
    }

    // Helper để sort numeric strings đúng cách
    const numericSort = (a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    };

    // Convert Sets to sorted Arrays
    const result = {
      brands: Array.from(brands).sort(),
      specs: {
        cpu: Array.from(specValues.cpu).sort(),
        gpu: Array.from(specValues.gpu).sort(),
        ram: Array.from(specValues.ram).sort(numericSort),
        storage: Array.from(specValues.storage).sort(numericSort),
        screenInch: Array.from(specValues.screenInch).sort(numericSort),
        cpuSeries: Array.from(specValues.cpuSeries).sort(),
        cpuSocket: Array.from(specValues.cpuSocket).sort(),
        cpuCores: Array.from(specValues.cpuCores).sort(numericSort),
        mbSocket: Array.from(specValues.mbSocket).sort(),
        mbRamType: Array.from(specValues.mbRamType).sort(),
        mbChipset: Array.from(specValues.mbChipset).sort(),
        ramType: Array.from(specValues.ramType).sort(),
        ramCapacity: Array.from(specValues.ramCapacity).sort(numericSort),
        ramBus: Array.from(specValues.ramBus).sort(numericSort),
        ssdCapacity: Array.from(specValues.ssdCapacity).sort(numericSort),
        ssdInterface: Array.from(specValues.ssdInterface).sort(),
        ssdForm: Array.from(specValues.ssdForm).sort(),
        vgaSeries: Array.from(specValues.vgaSeries).sort(),
        vram: Array.from(specValues.vram).sort(numericSort),
        kbSwitch: Array.from(specValues.kbSwitch).sort(),
        kbLayout: Array.from(specValues.kbLayout).sort(),
        kbConnection: Array.from(specValues.kbConnection).sort(),
        mouseDpi: Array.from(specValues.mouseDpi).sort(numericSort),
        mouseWeight: Array.from(specValues.mouseWeight).sort(numericSort),
        mouseConnection: Array.from(specValues.mouseConnection).sort(),
      },
      total: products.length,
    };

    res.json(result);
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
