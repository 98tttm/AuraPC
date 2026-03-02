/**
 * Product filter building logic.
 * Extracted from the GET /api/products route handler for maintainability.
 */

const Category = require('../models/Category');

/**
 * Trả về mảng [category_id/slug] (string) gồm bản thân + mọi danh mục con.
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

/**
 * Resolve category { _id, category_id, name, slug } từ category_id hoặc primaryCategoryId.
 */
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

/** Chuẩn hóa product cho UI: images[] string, ẩn source/url. */
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

/** Build sort object from query param. */
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

/** Escape string for use in RegExp. */
function escapeRegex(s) {
    return String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build MongoDB filter, sort, skip, limit from query params.
 * Returns { filter, sort, skip, limit, page }.
 */
async function buildProductFilter(query) {
    const {
        category, search, featured,
        page = 1, limit = 12, brand, minPrice, maxPrice, sort,
        cpu, gpu, screenInch, storage, ram,
        cpuSeries, cpuSocket, cpuCores,
        mbSocket, mbRamType, mbChipset,
        ramType, ramCapacity, ramBus,
        ssdCapacity, ssdInterface, ssdForm,
        vgaSeries, vram,
        kbSwitch, kbLayout, kbConnection,
        mouseDpi, mouseWeight, mouseConnection,
    } = query;

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

    // Helper: query → array of strings
    function toArray(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean);
        return String(val).split(',').map(s => s.trim()).filter(Boolean);
    }

    // Brand filter
    const brandList = toArray(brand);
    if (brandList.length) {
        filter.$and.push({
            $or: brandList.flatMap((b) => {
                const re = new RegExp(escapeRegex(b), 'i');
                return [{ brand: re }, { name: re }, { shortDescription: re }];
            }),
        });
    }

    // Price range
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

    // Search text
    if (search && search.trim()) {
        const escapedSearch = escapeRegex(search);
        filter.$and.push({
            $or: [
                { name: new RegExp(escapedSearch, 'i') },
                { shortDescription: new RegExp(escapedSearch, 'i') },
            ],
        });
    }

    // Spec filters — generic helper
    function addSpecFilter(value, specKeys) {
        if (!value || !String(value).trim()) return;
        const val = escapeRegex(value);
        const conditions = [];
        for (const key of specKeys) {
            conditions.push({ [`specs.${key}`]: new RegExp(val, 'i') });
            conditions.push({ [`techSpecs.${key}`]: new RegExp(val, 'i') });
        }
        filter.$and.push({ $or: conditions });
    }

    addSpecFilter(cpu, ['CPU']);
    addSpecFilter(gpu, ['Card đồ họa', 'GPU', 'VGA']);
    addSpecFilter(screenInch, ['Màn hình', 'Kích thước màn hình']);
    addSpecFilter(storage, ['Ổ cứng', 'SSD']);
    addSpecFilter(ram, ['RAM']);
    addSpecFilter(cpuSeries, ['CPU', 'Dòng CPU']);
    addSpecFilter(cpuSocket, ['Socket', 'Kiến trúc']);
    addSpecFilter(cpuCores, ['Số nhân', 'Số nhân xử lý', 'Số nhân (Cores)']);
    addSpecFilter(mbSocket, ['CPU', 'PROROCESSOR']);
    addSpecFilter(mbRamType, ['MEMORY', 'Memory']);
    addSpecFilter(mbChipset, ['CHIPSET', 'Chipset']);
    addSpecFilter(ramType, ['Chuẩn Ram', 'Chuẩn RAM']);
    addSpecFilter(ramCapacity, ['Dung lượng']);
    addSpecFilter(ramBus, ['Bus hỗ trợ', 'Tốc độ SPD', 'Tốc độ']);
    addSpecFilter(ssdCapacity, ['Dung lượng']);
    addSpecFilter(ssdInterface, ['Chuẩn giao tiếp', 'Giao tiếp']);
    addSpecFilter(ssdForm, ['Kích thước / Loại:', 'Phân loại']);
    addSpecFilter(kbSwitch, ['Kiểu Switch', 'Switch']);
    addSpecFilter(kbLayout, ['Kích thước/Layout', 'Layout']);
    addSpecFilter(kbConnection, ['Phương thức kết nối', 'Kết nối']);
    addSpecFilter(mouseDpi, ['DPI', 'Độ nhạy (DPI)']);
    addSpecFilter(mouseWeight, ['Trọng lượng']);
    addSpecFilter(mouseConnection, ['Chuẩn kết nối', 'Kết nối']);

    // VGA series: special handling for flexible matching
    if (vgaSeries && String(vgaSeries).trim()) {
        const raw = String(vgaSeries).trim();
        const val = escapeRegex(raw);
        const coreMatch = raw.match(/(?:RTX|GTX|RX)\s*\d{3,5}(?:\s*XT)?/i);
        const searchTerms = [val];
        if (coreMatch && coreMatch[0] !== raw) searchTerms.push(escapeRegex(coreMatch[0]));
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

    // VRAM filter: flexible "8GB" / "8 GB" matching
    if (vram && String(vram).trim()) {
        const raw = String(vram).trim();
        const val = escapeRegex(raw);
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

    const skipVal = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, parseInt(limit, 10) || 12);
    const limitNum = Math.min(50, parseInt(limit, 10) || 12);
    const sortObj = getSort(sort);

    return { filter, sort: sortObj, skip: skipVal, limit: limitNum, page: parseInt(page, 10) };
}

module.exports = {
    getCategoryIdsIncludingDescendants,
    resolveCategoryForProducts,
    normalizeProductForUI,
    getSort,
    escapeRegex,
    buildProductFilter,
};
