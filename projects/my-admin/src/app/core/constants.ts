// === Order Status Labels ===
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  processing: 'Đang xử lý',
  shipped: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã huỷ',
};

export const ORDER_STATUS_KEYS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = typeof ORDER_STATUS_KEYS[number];

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: '#eab308',
  confirmed: '#2563eb',
  processing: '#7c3aed',
  shipped: '#0d9488',
  delivered: '#16a34a',
  cancelled: '#dc2626',
};

// === User Segments ===
export const USER_SEGMENTS = {
  vip: { minOrders: 10, label: 'VIP', badge: 'vip' },
  regular: { minOrders: 3, label: 'Thường xuyên', badge: 'regular' },
  new: { minOrders: 1, label: 'Mới', badge: 'new' },
  inactive: { minOrders: 0, label: 'Chưa mua', badge: 'inactive' },
} as const;

export function getUserSegment(orderCount: number): keyof typeof USER_SEGMENTS {
  if (orderCount >= 10) return 'vip';
  if (orderCount >= 3) return 'regular';
  if (orderCount >= 1) return 'new';
  return 'inactive';
}

export function getUserSegmentLabel(orderCount: number): string {
  return USER_SEGMENTS[getUserSegment(orderCount)].label;
}

// === Stock Thresholds ===
export const STOCK_THRESHOLDS = {
  low: 5,
  max: 50,
} as const;

export function getStockStatus(stock: number): 'active' | 'low-stock' | 'out-of-stock' {
  if (stock === 0) return 'out-of-stock';
  if (stock < STOCK_THRESHOLDS.low) return 'low-stock';
  return 'active';
}

export function getStockLabel(stock: number, active?: boolean): string {
  if (stock === 0) return 'Hết hàng';
  if (stock < STOCK_THRESHOLDS.low) return 'Sắp hết';
  if (active === false) return 'Ẩn';
  return 'Đang bán';
}

export function getStockPercent(stock: number): number {
  return Math.min(100, (stock / STOCK_THRESHOLDS.max) * 100);
}

// === Slug Generation ===
export function generateSlug(text: string): string {
  const vietnameseMap: Record<string, string> = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'đ': 'd',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
  };
  return text
    .toLowerCase()
    .split('')
    .map(c => vietnameseMap[c] || c)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
