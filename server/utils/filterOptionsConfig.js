/**
 * Per-category filter extraction config.
 * Defines which spec-based filters to extract for each product category.
 * Used by the /api/products/filter-options endpoint.
 */
const {
    normalizeGpuChip,
    normalizeVram,
    normalizeSocket,
    normalizeCpuSeries,
    normalizeChipset,
    normalizeRamType,
    normalizeCapacity,
    normalizeRamBus,
    normalizeSsdInterface,
    normalizeSsdForm,
    normalizeKbLayout,
    normalizeConnection,
    normalizeMouseDpi,
} = require('./productNormalizers');

/**
 * Key = category slug.
 * Value = array of { target, keys, normalize } objects.
 *  - target: field name in the response specs object
 *  - keys: spec field names to search in product.specs / product.techSpecs
 *  - normalize: function to normalize the raw value (null = keep as-is)
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
        { target: 'kbSwitch', keys: ['Kiểu Switch', 'Switch'], normalize: null },
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
                const m2 = val.match(/^(\d+\.?\d*)/);
                if (m2) { const n = parseFloat(m2[1]); if (n >= 13 && n <= 55) return n + '"'; }
                return null;
            }
        },
    ],
};

/** All possible spec keys returned in filter-options response. */
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

/** Fields that should be sorted numerically. */
const NUMERIC_FIELDS = new Set([
    'vram', 'ramCapacity', 'ssdCapacity', 'ramBus', 'screenInch', 'mouseDpi',
]);

module.exports = { CATEGORY_FILTER_MAP, ALL_SPEC_KEYS, NUMERIC_FIELDS };
