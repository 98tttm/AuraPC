/**
 * Danh sách thương hiệu PC/gaming phổ biến.
 * Thứ tự: brand dài/đặc biệt trước (ROG, REPUBLIC OF GAMERS → ASUS).
 */
const KNOWN_BRANDS = [
  'COOLER MASTER', 'WESTERN DIGITAL', 'REPUBLIC OF GAMERS', 'ROG',
  'ASUS', 'GIGABYTE', 'MSI', 'CORSAIR', 'NZXT', 'DEEPCOOL',
  'THERMALTAKE', 'LIAN LI', 'BE QUIET', 'NOCTUA', 'ARCTIC', 'RAZER',
  'LOGITECH', 'KINGSTON', 'SAMSUNG', 'WD', 'SEAGATE',
  'CRUCIAL', 'G.SKILL', 'TEAMGROUP', 'TEAM', 'GEIL', 'PATRIOT',
  'SAPPHIRE', 'POWERCOLOR', 'XFX', 'ZOTAC', 'INNO3D', 'COLORFUL',
  'GALAX', 'PNY', 'EVGA', 'PALIT', 'SEASONIC', 'FSP', 'XIGMATEK',
  'SEGOTEP', 'SILVERSTONE', 'COUGAR', 'HYTE', 'PHANTEKS',
  'INTEL', 'AMD', 'AKKO', 'KEYCHRON', 'MONSGEEK', 'DUCKY',
  'STEELSERIES', 'HYPERX', 'HP', 'DELL', 'LENOVO', 'ACER', 'LG',
  'VIEWSONIC', 'AOC', 'BENQ', 'ADATA', 'EDRA', 'VEEKOS',
  'NVIDIA', 'XIAOMI', 'HUAWEI', 'APPLE', 'MACBOOK', 'JBL',
  'SENNHEISER', 'JABRA',
];

/** ROG (Republic of Gamers) → ASUS */
const SUB_BRAND_MAP = { ROG: 'ASUS', 'REPUBLIC OF GAMERS': 'ASUS' };

/**
 * Trích xuất brand từ tên sản phẩm.
 * @param {string} name - Tên sản phẩm
 * @returns {string|null} - Tên brand (đúng format trong KNOWN_BRANDS) hoặc null
 */
function extractBrandFromName(name) {
  if (!name || typeof name !== 'string') return null;
  const upper = name.toUpperCase().trim();
  if (!upper) return null;

  for (const b of KNOWN_BRANDS) {
    const pattern = new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(name)) {
      const mapped = SUB_BRAND_MAP[b] || b;
      return KNOWN_BRANDS.find((kb) => kb === mapped) || mapped;
    }
  }
  return null;
}

module.exports = { KNOWN_BRANDS, extractBrandFromName };
