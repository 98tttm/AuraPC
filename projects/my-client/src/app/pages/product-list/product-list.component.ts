import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ApiService,
  Category,
  Product,
  ProductSort,
  productMainImage,
  productDisplayPrice,
  productHasSale,
  productSalePercent,
} from '../../core/services/api.service';

const PRICE_RANGES: { id: string; label: string; min?: number; max?: number }[] = [
  { id: 'all', label: 'Tất Cả' },
  { id: 'under500', label: 'Dưới 500,000₫', max: 500000 },
  { id: '500_5m', label: '500,000₫ - 5,000,000₫', min: 500000, max: 5000000 },
  { id: '5m_15m', label: '5,000,000₫ - 15,000,000₫', min: 5000000, max: 15000000 },
  { id: '15m_30m', label: '15,000,000₫ - 30,000,000₫', min: 15000000, max: 30000000 },
  { id: 'over30m', label: 'Trên 30,000,000₫', min: 30000000 },
];

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'featured', label: 'Nổi bật' },
  { value: 'price_asc', label: 'Giá: Tăng dần' },
  { value: 'price_desc', label: 'Giá: Giảm dần' },
  { value: 'name_asc', label: 'A-Z' },
  { value: 'name_desc', label: 'Z-A' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'best_seller', label: 'Bán chạy' },
];

/** Trích từ chuỗi CPU: Intel, AMD Ryzen, AMD. */
function extractCpuLabels(s: string): string[] {
  const out: string[] = [];
  if (/Intel/i.test(s)) out.push('Intel');
  if (/AMD\s*Ryzen/i.test(s)) out.push('AMD Ryzen');
  else if (/AMD/i.test(s)) out.push('AMD');
  return out;
}
/** Trích GPU: NVIDIA, AMD, Intel. */
function extractGpuLabels(s: string): string[] {
  const out: string[] = [];
  if (/NVIDIA/i.test(s)) out.push('NVIDIA');
  if (/AMD/i.test(s)) out.push('AMD');
  if (/Intel/i.test(s)) out.push('Intel');
  return out;
}
/** Trích kích thước màn hình (inch): chỉ số đi kèm " hoặc ' hoặc "inch", và trong khoảng 10–24 inch (laptop/màn hình thường). */
function extractScreenInches(s: string): string[] {
  const out: string[] = [];
  const re = /(\d+\.?\d*)\s*(["']|\s*inch)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const num = parseFloat(m[1]);
    if (num >= 10 && num <= 24) out.push(m[1]);
  }
  return [...new Set(out)];
}
/** Trích dung lượng ổ: 256GB, 512GB, 1TB, 2TB... */
function extractStorageLabels(s: string): string[] {
  const out: string[] = [];
  const gb = s.match(/(\d+)\s*GB/i); if (gb) out.push(gb[1] + 'GB');
  const tb = s.match(/(\d+)\s*TB/i); if (tb) out.push(tb[1] + 'TB');
  return out;
}
/** Trích RAM: 8GB, 16GB, 32GB, 64GB. */
function extractRamLabels(s: string): string[] {
  const matches = s.match(/(\d+)\s*GB/i); return matches ? [matches[1] + 'GB'] : [];
}

/** Lấy giá trị spec từ product (specs hoặc techSpecs), thử lần lượt các key. */
function getSpecValue(p: Product, keys: string[]): string | null {
  const spec = (p.specs ?? p.techSpecs ?? {}) as Record<string, string>;
  for (const k of keys) {
    const v = spec[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

/** Trích options cho bộ lọc Linh Kiện / Gaming Gear từ danh sách sản phẩm (theo data thật). */
function buildComponentFilterOptions(
  items: Product[],
  type: 'cpu' | 'mainboard' | 'ram' | 'ssd' | 'vga' | 'keyboard' | 'mouse'
): Record<string, string[]> {
  const sortStr = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
  const add = (set: Set<string>, p: Product, keys: string[]) => {
    const v = getSpecValue(p, keys);
    if (v) set.add(v);
  };
  if (type === 'cpu') {
    const cpuSeries = new Set<string>(), cpuSocket = new Set<string>(), cpuCores = new Set<string>();
    for (const p of items) {
      add(cpuSeries, p, ['Dòng CPU', 'CPU', 'Tên gọi', 'Model']);
      add(cpuSocket, p, ['Socket', 'Kiến trúc']);
      add(cpuCores, p, ['Số nhân', 'Số nhân (Cores)', 'Số nhân xử lý', 'Số nhân / Luồng', 'Nhân CPU']);
    }
    return {
      cpuSeries: Array.from(cpuSeries).sort(sortStr),
      cpuSocket: Array.from(cpuSocket).sort(sortStr),
      cpuCores: Array.from(cpuCores).sort(sortStr),
    };
  }
  if (type === 'mainboard') {
    const mbSocket = new Set<string>(), mbRamType = new Set<string>(), mbChipset = new Set<string>();
    for (const p of items) {
      add(mbSocket, p, ['Socket', 'CPU', 'PROROCESSOR']);
      add(mbRamType, p, ['Chuẩn Ram', 'Chuẩn RAM', 'MEMORY', 'Memory', 'Hỗ trợ Ram']);
      add(mbChipset, p, ['CHIPSET', 'Chipset']);
    }
    return { mbSocket: Array.from(mbSocket).sort(sortStr), mbRamType: Array.from(mbRamType).sort(sortStr), mbChipset: Array.from(mbChipset).sort(sortStr) };
  }
  if (type === 'ram') {
    const ramType = new Set<string>(), ramCapacity = new Set<string>(), ramBus = new Set<string>();
    for (const p of items) {
      add(ramType, p, ['Chuẩn Ram', 'Chuẩn RAM', 'Loại']);
      add(ramCapacity, p, ['Dung lượng']);
      add(ramBus, p, ['Bus hỗ trợ', 'Tốc độ SPD', 'Tốc độ', 'Bus']);
    }
    return { ramType: Array.from(ramType).sort(sortStr), ramCapacity: Array.from(ramCapacity).sort(sortStr), ramBus: Array.from(ramBus).sort(sortStr) };
  }
  if (type === 'ssd') {
    const ssdCapacity = new Set<string>(), ssdInterface = new Set<string>(), ssdForm = new Set<string>();
    for (const p of items) {
      add(ssdCapacity, p, ['Dung lượng']);
      add(ssdInterface, p, ['Chuẩn giao tiếp', 'Giao tiếp', 'Giao tiếp SSD']);
      add(ssdForm, p, ['Kích thước / Loại:', 'Phân loại', 'Form']);
    }
    return { ssdCapacity: Array.from(ssdCapacity).sort(sortStr), ssdInterface: Array.from(ssdInterface).sort(sortStr), ssdForm: Array.from(ssdForm).sort(sortStr) };
  }
  if (type === 'vga') {
    const vgaSeries = new Set<string>(), vram = new Set<string>();
    for (const p of items) {
      add(vgaSeries, p, ['Graphics Processing', 'Chipset', 'Card đồ họa', 'GPU', 'VGA']);
      add(vram, p, ['Memory Size', 'VRAM', 'Dung lượng bộ nhớ']);
    }
    return { vgaSeries: Array.from(vgaSeries).sort(sortStr), vram: Array.from(vram).sort(sortStr) };
  }
  if (type === 'keyboard') {
    const kbSwitch = new Set<string>(), kbLayout = new Set<string>(), kbConnection = new Set<string>();
    for (const p of items) {
      add(kbSwitch, p, ['Kiểu Switch', 'Switch']);
      add(kbLayout, p, ['Kích thước/Layout', 'Layout', 'Kích thước']);
      add(kbConnection, p, ['Phương thức kết nối', 'Kết nối']);
    }
    return { kbSwitch: Array.from(kbSwitch).sort(sortStr), kbLayout: Array.from(kbLayout).sort(sortStr), kbConnection: Array.from(kbConnection).sort(sortStr) };
  }
  if (type === 'mouse') {
    const mouseDpi = new Set<string>(), mouseWeight = new Set<string>(), mouseConnection = new Set<string>();
    for (const p of items) {
      add(mouseDpi, p, ['DPI', 'Độ nhạy (DPI)']);
      add(mouseWeight, p, ['Trọng lượng']);
      add(mouseConnection, p, ['Chuẩn kết nối', 'Kết nối']);
    }
    return { mouseDpi: Array.from(mouseDpi).sort(sortStr), mouseWeight: Array.from(mouseWeight).sort(sortStr), mouseConnection: Array.from(mouseConnection).sort(sortStr) };
  }
  return {};
}

/** Cache options bộ lọc theo từng nhóm danh mục (Linh Kiện, Gaming Gear). */
type ComponentFilterOptionsCache = {
  cpu?: { cpuSeries: string[]; cpuSocket: string[]; cpuCores: string[] };
  mainboard?: { mbSocket: string[]; mbRamType: string[]; mbChipset: string[] };
  ram?: { ramType: string[]; ramCapacity: string[]; ramBus: string[] };
  ssd?: { ssdCapacity: string[]; ssdInterface: string[]; ssdForm: string[] };
  vga?: { vgaSeries: string[]; vram: string[] };
  keyboard?: { kbSwitch: string[]; kbLayout: string[]; kbConnection: string[] };
  mouse?: { mouseDpi: string[]; mouseWeight: string[]; mouseConnection: string[] };
};

import { CartService } from '../../core/services/cart.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductListComponent {
  private api = inject(ApiService);
  private cart = inject(CartService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly priceRanges = PRICE_RANGES;
  readonly sortOptions = SORT_OPTIONS;

  categories = signal<Category[]>([]);
  /** Báo cáo danh mục + số sản phẩm mỗi danh mục (để chỉ hiện tag có sản phẩm). */
  categoryReport = signal<{ categories: (Category & { productCount: number })[] } | null>(null);

  rootCategories = computed(() => {
    const list = this.categories();
    return list.filter((c) => (c.level === 1) || (c.parent_id == null || c.parent_id === '' || c.parent_id === undefined));
  });
  mainCategories = computed(() => this.rootCategories().slice(0, 8));
  childrenByParentId = computed(() => {
    const list = this.categories();
    const map = new Map<string, Category[]>();
    list.forEach((c) => {
      const pid = c.parent_id != null && c.parent_id !== '' ? String(c.parent_id) : null;
      if (pid) {
        const arr = map.get(pid) ?? [];
        arr.push(c);
        map.set(pid, arr);
      }
    });
    map.forEach((arr) => arr.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)));
    return map;
  });

  /** Thương hiệu lấy từ sản phẩm hiện có (đồng bộ với dữ liệu). */
  brands = computed(() => {
    const list = this.products();
    const set = new Set<string>();
    list.forEach((p) => {
      const b = (p.brand ?? '').trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  products = signal<Product[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = 24;
  loading = signal(true);
  loadingProducts = signal(true);
  loadingMore = signal(false);
  selectedCategoryId = signal<string | null>(null);
  searchTerm = signal<string>('');
  /** Có thể chọn nhiều thương hiệu cùng lúc (multi-select). */
  selectedBrands = signal<string[]>([]);
  selectedPriceRangeId = signal<string>('all');
  currentSort = signal<ProductSort>('featured');
  /** Bộ lọc Laptop (chỉ dùng khi danh mục là Laptop). */
  selectedCpu = signal<string | null>(null);
  selectedGpu = signal<string | null>(null);
  selectedScreenInch = signal<string | null>(null);
  selectedStorage = signal<string | null>(null);
  selectedRam = signal<string | null>(null);
  /** Bộ lọc chi tiết cho Linh Kiện PC & Gaming Gear. */
  // CPU
  selectedCpuSeries = signal<string | null>(null);
  selectedCpuSocket = signal<string | null>(null);
  selectedCpuCores = signal<string | null>(null);
  // Mainboard
  selectedMbSocket = signal<string | null>(null);
  selectedMbRamType = signal<string | null>(null);
  selectedMbChipset = signal<string | null>(null);
  // RAM
  selectedRamType = signal<string | null>(null);
  selectedRamCapacity = signal<string | null>(null);
  selectedRamBus = signal<string | null>(null);
  // SSD
  selectedSsdCapacity = signal<string | null>(null);
  selectedSsdInterface = signal<string | null>(null);
  selectedSsdForm = signal<string | null>(null);
  // VGA
  selectedVgaSeries = signal<string | null>(null);
  selectedVram = signal<string | null>(null);
  // Bàn phím
  selectedKbSwitch = signal<string | null>(null);
  selectedKbLayout = signal<string | null>(null);
  selectedKbConnection = signal<string | null>(null);
  // Chuột
  selectedMouseDpi = signal<string | null>(null);
  selectedMouseWeight = signal<string | null>(null);
  selectedMouseConnection = signal<string | null>(null);
  /** Cache danh sách options (từ lần load chung), gồm cả Thương hiệu để không bị thiếu. */
  laptopFilterOptionsCache = signal<{
    brands: string[];
    cpu: string[];
    gpu: string[];
    screenInch: string[];
    storage: string[];
    ram: string[];
  } | null>(null);
  /** Cache options bộ lọc Linh Kiện (CPU, Mainboard, RAM, SSD, VGA) và Gaming Gear (Bàn phím, Chuột). */
  componentFilterOptionsCache = signal<ComponentFilterOptionsCache | null>(null);
  /** Trạng thái mở/đóng từng group filter trong sidebar. Cho phép mở nhiều group cùng lúc. */
  openFilterSections = signal<Record<string, boolean>>({
    brand: true,
    price: true,
  });

  selectedCategoryName = computed(() => {
    const id = this.selectedCategoryId();
    if (!id) return 'Tất cả sản phẩm';
    const c = this.categories().find(
      (x) => String(x.category_id ?? x.slug ?? x._id) === String(id)
    );
    return c?.name ?? 'Sản phẩm';
  });

  /** Build danh sách categories từ root → current để hiển thị breadcrumb hierarchy. */
  categoryBreadcrumb = computed(() => {
    const cats = this.categories();
    const catId = this.selectedCategoryId();
    if (!catId) return [];

    const chain: { id: string; name: string }[] = [];
    let current = cats.find(
      (c) => String(c.category_id ?? c.slug ?? c._id) === catId
    );

    while (current) {
      chain.unshift({
        id: current.category_id ?? current.slug ?? String(current._id),
        name: current.name,
      });
      if (!current.parent_id) break;
      current = cats.find(
        (c) => String(c.category_id ?? c.slug ?? c._id) === String(current!.parent_id)
      );
    }
    return chain;
  });

  /** Đang xem danh mục Laptop (bản thân hoặc con của laptop). */
  isLaptopCategory = computed(() => this.hasAncestorCategory('laptop'));
  /** Các nhóm danh mục khác cho bộ lọc chi tiết. */
  isCpuCategory = computed(() => this.hasAncestorCategory('cpu'));
  isMainboardCategory = computed(() => this.hasAncestorCategory('mainboard'));
  isRamCategory = computed(() => this.hasAncestorCategory('ram'));
  isSsdCategory = computed(() => this.hasAncestorCategory('ssd'));
  isVgaCategory = computed(() => this.hasAncestorCategory('vga'));
  isKeyboardCategory = computed(() => this.hasAncestorCategory('ban-phim-may-tinh'));
  isMouseCategory = computed(() => this.hasAncestorCategory('chuot-may-tinh'));

  /** Bộ lọc Laptop: luôn dùng cache (từ lần load chung) để không mất option khi chọn. */
  laptopFilters = computed(() => {
    if (!this.isLaptopCategory()) return null;
    const cache = this.laptopFilterOptionsCache();
    if (cache) return cache;
    return {
      brands: [] as string[],
      cpu: [] as string[],
      gpu: [] as string[],
      screenInch: [] as string[],
      storage: [] as string[],
      ram: [] as string[],
    };
  });

  /** Bộ lọc Linh Kiện & Gaming Gear: options lấy từ cache (build từ data thật). */
  componentFilters = computed(() => {
    const cache = this.componentFilterOptionsCache();
    if (!cache) return null;
    if (this.isCpuCategory() && cache.cpu) return { type: 'cpu' as const, ...cache.cpu };
    if (this.isMainboardCategory() && cache.mainboard) return { type: 'mainboard' as const, ...cache.mainboard };
    if (this.isRamCategory() && cache.ram) return { type: 'ram' as const, ...cache.ram };
    if (this.isSsdCategory() && cache.ssd) return { type: 'ssd' as const, ...cache.ssd };
    if (this.isVgaCategory() && cache.vga) return { type: 'vga' as const, ...cache.vga };
    if (this.isKeyboardCategory() && cache.keyboard) return { type: 'keyboard' as const, ...cache.keyboard };
    if (this.isMouseCategory() && cache.mouse) return { type: 'mouse' as const, ...cache.mouse };
    return null;
  });

  /** Danh sách Thương hiệu: trên Laptop dùng cache, ngoài Laptop dùng từ products(). */
  brandOptions = computed(() => {
    if (this.isLaptopCategory()) {
      const cache = this.laptopFilterOptionsCache();
      return cache?.brands ?? this.brands();
    }
    return this.brands();
  });

  /** Khi chưa chọn danh mục: hiện Lv1. Khi đã chọn (vd Laptop): hiện danh mục con (ACER, ASUS, MSI, ...). Bấm tag = chuyển trang + lọc. */
  categoryTags = computed(() => {
    const report = this.categoryReport();
    const roots = this.rootCategories();
    const selectedId = this.selectedCategoryId();
    const countByCid = new Map<string, number>();
    if (report?.categories) {
      report.categories.forEach((r) => {
        const cid = r.category_id ?? r.slug ?? String(r._id);
        if (r.productCount != null && r.productCount > 0) countByCid.set(cid, r.productCount);
      });
    }
    if (!selectedId) {
      return roots
        .filter((r) => {
          const cid = r.category_id ?? r.slug ?? String(r._id);
          return countByCid.has(cid) && (countByCid.get(cid) ?? 0) > 0;
        })
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((c) => ({
          id: c.category_id ?? c.slug ?? String(c._id),
          name: c.name,
        }));
    }
    const childrenByParent = this.childrenByParentId();
    let list = childrenByParent.get(selectedId) ?? [];
    // Nếu danh mục hiện tại là lá (không có con), hiển thị anh em cùng cha (giữ nguyên hàng tag nhỏ nhất).
    if (!list.length) {
      const all = this.categories();
      const current = all.find((c) => {
        const cid = c.category_id ?? c.slug ?? String(c._id);
        return cid === selectedId;
      });
      if (current?.parent_id) {
        list = childrenByParent.get(String(current.parent_id)) ?? [];
      }
    }
    return list
      .filter((c) => {
        const cid = c.category_id ?? c.slug ?? String(c._id);
        return countByCid.has(cid) && (countByCid.get(cid) ?? 0) > 0;
      })
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((c) => ({
        id: c.category_id ?? c.slug ?? String(c._id),
        name: c.name,
      }));
  });

  remainingCount = computed(() => Math.max(0, this.total() - this.products().length));
  hasMore = computed(() => this.remainingCount() > 0);

  /** Kiểm tra selectedCategoryId có thuộc cây ancestorId hay không (dùng category_id/slug). */
  private hasAncestorCategory(ancestorId: string): boolean {
    const id = this.selectedCategoryId();
    if (!id) return false;
    const list = this.categories();
    let cur = list.find((x) => String(x.category_id ?? x.slug ?? x._id) === id);
    while (cur) {
      const cid = cur.category_id ?? cur.slug ?? String(cur._id);
      if (cid === ancestorId) return true;
      const parentId = cur.parent_id;
      if (!parentId) return false;
      cur = list.find((x) => String(x.category_id ?? x.slug ?? x._id) === String(parentId));
    }
    return false;
  }

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    const qCategory = qp.get('category');
    if (qCategory) this.selectedCategoryId.set(qCategory);
    const qSearch = qp.get('search');
    if (qSearch) this.searchTerm.set(qSearch);
    const qSort = qp.get('sort') as ProductSort | null;
    if (qSort && SORT_OPTIONS.some((o) => o.value === qSort)) this.currentSort.set(qSort);
    const qBrand = qp.get('brand');
    if (qBrand) {
      const list = qBrand
        .split(',')
        .map((s) => s.trim())
        .filter((s) => !!s);
      this.selectedBrands.set(list);
    }
    const qPrice = qp.get('price'); if (qPrice != null && PRICE_RANGES.some((r) => r.id === qPrice)) this.selectedPriceRangeId.set(qPrice);
    const qCpu = qp.get('cpu'); if (qCpu) this.selectedCpu.set(qCpu);
    const qGpu = qp.get('gpu'); if (qGpu) this.selectedGpu.set(qGpu);
    const qScreen = qp.get('screenInch'); if (qScreen) this.selectedScreenInch.set(qScreen);
    const qStorage = qp.get('storage'); if (qStorage) this.selectedStorage.set(qStorage);
    const qRam = qp.get('ram'); if (qRam) this.selectedRam.set(qRam);
    // CPU chi tiết
    const qCpuSeries = qp.get('cpuSeries'); if (qCpuSeries) this.selectedCpuSeries.set(qCpuSeries);
    const qCpuSocket = qp.get('cpuSocket'); if (qCpuSocket) this.selectedCpuSocket.set(qCpuSocket);
    const qCpuCores = qp.get('cpuCores'); if (qCpuCores) this.selectedCpuCores.set(qCpuCores);
    // Mainboard
    const qMbSocket = qp.get('mbSocket'); if (qMbSocket) this.selectedMbSocket.set(qMbSocket);
    const qMbRamType = qp.get('mbRamType'); if (qMbRamType) this.selectedMbRamType.set(qMbRamType);
    const qMbChipset = qp.get('mbChipset'); if (qMbChipset) this.selectedMbChipset.set(qMbChipset);
    // RAM
    const qRamType = qp.get('ramType'); if (qRamType) this.selectedRamType.set(qRamType);
    const qRamCapacity = qp.get('ramCapacity'); if (qRamCapacity) this.selectedRamCapacity.set(qRamCapacity);
    const qRamBus = qp.get('ramBus'); if (qRamBus) this.selectedRamBus.set(qRamBus);
    // SSD
    const qSsdCapacity = qp.get('ssdCapacity'); if (qSsdCapacity) this.selectedSsdCapacity.set(qSsdCapacity);
    const qSsdInterface = qp.get('ssdInterface'); if (qSsdInterface) this.selectedSsdInterface.set(qSsdInterface);
    const qSsdForm = qp.get('ssdForm'); if (qSsdForm) this.selectedSsdForm.set(qSsdForm);
    // VGA
    const qVgaSeries = qp.get('vgaSeries'); if (qVgaSeries) this.selectedVgaSeries.set(qVgaSeries);
    const qVram = qp.get('vram'); if (qVram) this.selectedVram.set(qVram);
    // Bàn phím
    const qKbSwitch = qp.get('kbSwitch'); if (qKbSwitch) this.selectedKbSwitch.set(qKbSwitch);
    const qKbLayout = qp.get('kbLayout'); if (qKbLayout) this.selectedKbLayout.set(qKbLayout);
    const qKbConnection = qp.get('kbConnection'); if (qKbConnection) this.selectedKbConnection.set(qKbConnection);
    // Chuột
    const qMouseDpi = qp.get('mouseDpi'); if (qMouseDpi) this.selectedMouseDpi.set(qMouseDpi);
    const qMouseWeight = qp.get('mouseWeight'); if (qMouseWeight) this.selectedMouseWeight.set(qMouseWeight);
    const qMouseConnection = qp.get('mouseConnection'); if (qMouseConnection) this.selectedMouseConnection.set(qMouseConnection);

    this.api.getCategories().subscribe({
      next: (list) => {
        const sorted = [...list].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
        this.categories.set(sorted);
        this.loading.set(false);
        this.loadProducts(true);
        if (this.isLaptopCategory()) this.loadLaptopFilterOptionsIfNeeded();
        else this.loadComponentFilterOptionsIfNeeded();
      },
      error: () => this.loading.set(false),
    });
    this.api.getCategoriesReport().subscribe({
      next: (report) => this.categoryReport.set(report),
      error: () => { },
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((qp) => {
      const cat = qp.get('category');
      this.selectedCategoryId.set(cat ?? null);
      const search = qp.get('search');
      this.searchTerm.set(search ?? '');
      const sort = qp.get('sort') as ProductSort | null;
      if (sort && SORT_OPTIONS.some((o) => o.value === sort)) this.currentSort.set(sort);
      const qBrand2 = qp.get('brand');
      if (qBrand2) {
        const list = qBrand2
          .split(',')
          .map((s) => s.trim())
          .filter((s) => !!s);
        this.selectedBrands.set(list);
      } else {
        this.selectedBrands.set([]);
      }
      const pr = qp.get('price');
      if (pr != null && PRICE_RANGES.some((r) => r.id === pr)) this.selectedPriceRangeId.set(pr);
      else this.selectedPriceRangeId.set('all');
      this.selectedCpu.set(qp.get('cpu') ?? null);
      this.selectedGpu.set(qp.get('gpu') ?? null);
      this.selectedScreenInch.set(qp.get('screenInch') ?? null);
      this.selectedStorage.set(qp.get('storage') ?? null);
      this.selectedRam.set(qp.get('ram') ?? null);
      // CPU chi tiết
      this.selectedCpuSeries.set(qp.get('cpuSeries') ?? null);
      this.selectedCpuSocket.set(qp.get('cpuSocket') ?? null);
      this.selectedCpuCores.set(qp.get('cpuCores') ?? null);
      // Mainboard
      this.selectedMbSocket.set(qp.get('mbSocket') ?? null);
      this.selectedMbRamType.set(qp.get('mbRamType') ?? null);
      this.selectedMbChipset.set(qp.get('mbChipset') ?? null);
      // RAM
      this.selectedRamType.set(qp.get('ramType') ?? null);
      this.selectedRamCapacity.set(qp.get('ramCapacity') ?? null);
      this.selectedRamBus.set(qp.get('ramBus') ?? null);
      // SSD
      this.selectedSsdCapacity.set(qp.get('ssdCapacity') ?? null);
      this.selectedSsdInterface.set(qp.get('ssdInterface') ?? null);
      this.selectedSsdForm.set(qp.get('ssdForm') ?? null);
      // VGA
      this.selectedVgaSeries.set(qp.get('vgaSeries') ?? null);
      this.selectedVram.set(qp.get('vram') ?? null);
      // Bàn phím
      this.selectedKbSwitch.set(qp.get('kbSwitch') ?? null);
      this.selectedKbLayout.set(qp.get('kbLayout') ?? null);
      this.selectedKbConnection.set(qp.get('kbConnection') ?? null);
      // Chuột
      this.selectedMouseDpi.set(qp.get('mouseDpi') ?? null);
      this.selectedMouseWeight.set(qp.get('mouseWeight') ?? null);
      this.selectedMouseConnection.set(qp.get('mouseConnection') ?? null);
      if (!this.isLaptopCategory()) this.laptopFilterOptionsCache.set(null);
      if (this.categories().length > 0) this.loadProducts(true);
      if (this.isLaptopCategory()) this.loadLaptopFilterOptionsIfNeeded();
      else this.loadComponentFilterOptionsIfNeeded();
    });
  }

  /** Trích options Thương hiệu + CPU/GPU/... từ danh sách sản phẩm (dùng cho cache). */
  private buildLaptopFilterOptionsFromProducts(items: Product[]): {
    brands: string[];
    cpu: string[];
    gpu: string[];
    screenInch: string[];
    storage: string[];
    ram: string[];
  } {
    const brandSet = new Set<string>();
    const cpuSet = new Set<string>();
    const gpuSet = new Set<string>();
    const screenSet = new Set<string>();
    const storageSet = new Set<string>();
    const ramSet = new Set<string>();
    for (const p of items) {
      const b = (p.brand ?? '').trim();
      if (b) brandSet.add(b);
    }
    const specsKeys = [
      { k: 'CPU', cpu: true },
      { k: 'Card đồ họa', gpu: true },
      { k: 'GPU', gpu: true },
      { k: 'VGA', gpu: true },
      { k: 'Màn hình', screen: true },
      { k: 'Kích thước màn hình', screen: true },
      { k: 'Ổ cứng', storage: true },
      { k: 'Ổ cứng', storage: true },
      { k: 'RAM', ram: true },
    ];
    for (const p of items) {
      const specs = (p.specs ?? p.techSpecs ?? {}) as Record<string, string>;
      for (const { k, cpu, gpu, screen, storage, ram } of specsKeys) {
        const v = specs[k];
        if (v && typeof v === 'string') {
          if (cpu) extractCpuLabels(v).forEach((x) => cpuSet.add(x));
          if (gpu) extractGpuLabels(v).forEach((x) => gpuSet.add(x));
          if (screen) extractScreenInches(v).forEach((x) => screenSet.add(x));
          if (storage) extractStorageLabels(v).forEach((x) => storageSet.add(x));
          if (ram) extractRamLabels(v).forEach((x) => ramSet.add(x));
        }
      }
    }
    const sortStr = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
    return {
      brands: Array.from(brandSet).sort(sortStr),
      cpu: Array.from(cpuSet).sort(sortStr),
      gpu: Array.from(gpuSet).sort(sortStr),
      screenInch: Array.from(screenSet).sort(sortStr),
      storage: Array.from(storageSet).sort(sortStr),
      ram: Array.from(ramSet).sort(sortStr),
    };
  }

  /** Load một lần danh sách options từ API filter-options (toàn bộ sản phẩm trong category). */
  private loadLaptopFilterOptionsIfNeeded(): void {
    if (!this.isLaptopCategory() || this.laptopFilterOptionsCache() != null) return;
    const catId = this.selectedCategoryId();
    if (!catId) return;
    this.api.getFilterOptions(catId).subscribe({
      next: (res) => {
        if (!this.isLaptopCategory()) return;
        this.laptopFilterOptionsCache.set({
          brands: res.brands,
          cpu: res.specs.cpu,
          gpu: res.specs.gpu,
          screenInch: res.specs.screenInch,
          storage: res.specs.storage,
          ram: res.specs.ram,
        });
      },
    });
  }

  /** Load options bộ lọc cho Linh Kiện / Gaming Gear từ API filter-options. */
  private loadComponentFilterOptionsIfNeeded(): void {
    const catId = this.selectedCategoryId();
    if (!catId) return;
    const cache = this.componentFilterOptionsCache();
    let type: 'cpu' | 'mainboard' | 'ram' | 'ssd' | 'vga' | 'keyboard' | 'mouse' | null = null;
    if (this.isCpuCategory()) type = 'cpu';
    else if (this.isMainboardCategory()) type = 'mainboard';
    else if (this.isRamCategory()) type = 'ram';
    else if (this.isSsdCategory()) type = 'ssd';
    else if (this.isVgaCategory()) type = 'vga';
    else if (this.isKeyboardCategory()) type = 'keyboard';
    else if (this.isMouseCategory()) type = 'mouse';
    if (!type) {
      this.componentFilterOptionsCache.set(null);
      return;
    }
    const cacheKey = type;
    if (cache && (cache as Record<string, unknown>)[cacheKey]) return;
    this.api.getFilterOptions(catId).subscribe({
      next: (res) => {
        const prev = this.componentFilterOptionsCache();
        const specs = res.specs;
        let next: Record<string, string[]> = {};
        if (type === 'cpu') next = { cpuSeries: specs.cpuSeries, cpuSocket: specs.cpuSocket, cpuCores: specs.cpuCores };
        else if (type === 'mainboard') next = { mbSocket: specs.mbSocket, mbRamType: specs.mbRamType, mbChipset: specs.mbChipset };
        else if (type === 'ram') next = { ramType: specs.ramType, ramCapacity: specs.ramCapacity, ramBus: specs.ramBus };
        else if (type === 'ssd') next = { ssdCapacity: specs.ssdCapacity, ssdInterface: specs.ssdInterface, ssdForm: specs.ssdForm };
        else if (type === 'vga') next = { vgaSeries: specs.vgaSeries, vram: specs.vram };
        else if (type === 'keyboard') next = { kbSwitch: specs.kbSwitch, kbLayout: specs.kbLayout, kbConnection: specs.kbConnection };
        else if (type === 'mouse') next = { mouseDpi: specs.mouseDpi, mouseWeight: specs.mouseWeight, mouseConnection: specs.mouseConnection };
        this.componentFilterOptionsCache.set({ ...prev ?? {}, [cacheKey]: next });
      },
    });
  }

  /** Chuyển danh mục: chỉ giữ category + sort, xóa hết filter để mỗi trang độc lập. */
  selectCategory(id: string | number | null): void {
    const sid = id == null ? null : String(id);
    const q: Record<string, string | null> = { category: sid ?? null };
    if (this.currentSort() !== 'featured') q['sort'] = this.currentSort();
    this.router.navigate([], {
      queryParams: q,
      queryParamsHandling: '',
      relativeTo: this.route,
    });
  }

  /** Toggle 1 thương hiệu; cho phép chọn nhiều brand cùng lúc. brand = null => clear về Tất Cả. */
  selectBrand(brand: string | null): void {
    if (!brand) {
      this.selectedBrands.set([]);
    } else {
      const current = this.selectedBrands();
      const exists = current.includes(brand);
      const next = exists ? current.filter((b) => b !== brand) : [...current, brand];
      this.selectedBrands.set(next);
    }
    const list = this.selectedBrands();
    const brandParam = list.length ? list.join(',') : null;
    this.router.navigate([], {
      queryParams: { brand: brandParam },
      queryParamsHandling: 'merge',
      relativeTo: this.route,
    });
  }

  selectPriceRange(rangeId: string): void {
    this.selectedPriceRangeId.set(rangeId);
    this.router.navigate([], {
      queryParams: { price: rangeId === 'all' ? null : rangeId },
      queryParamsHandling: 'merge',
      relativeTo: this.route,
    });
  }

  /** Cập nhật 1 filter bất kỳ (Laptop, Linh Kiện, Gaming Gear...) và giữ nguyên các param còn lại. */
  setFilterParam(key: string, value: string | null): void {
    switch (key) {
      case 'cpu': this.selectedCpu.set(value ?? null); break;
      case 'gpu': this.selectedGpu.set(value ?? null); break;
      case 'screenInch': this.selectedScreenInch.set(value ?? null); break;
      case 'storage': this.selectedStorage.set(value ?? null); break;
      case 'ram': this.selectedRam.set(value ?? null); break;
      case 'cpuSeries': this.selectedCpuSeries.set(value ?? null); break;
      case 'cpuSocket': this.selectedCpuSocket.set(value ?? null); break;
      case 'cpuCores': this.selectedCpuCores.set(value ?? null); break;
      case 'mbSocket': this.selectedMbSocket.set(value ?? null); break;
      case 'mbRamType': this.selectedMbRamType.set(value ?? null); break;
      case 'mbChipset': this.selectedMbChipset.set(value ?? null); break;
      case 'ramType': this.selectedRamType.set(value ?? null); break;
      case 'ramCapacity': this.selectedRamCapacity.set(value ?? null); break;
      case 'ramBus': this.selectedRamBus.set(value ?? null); break;
      case 'ssdCapacity': this.selectedSsdCapacity.set(value ?? null); break;
      case 'ssdInterface': this.selectedSsdInterface.set(value ?? null); break;
      case 'ssdForm': this.selectedSsdForm.set(value ?? null); break;
      case 'vgaSeries': this.selectedVgaSeries.set(value ?? null); break;
      case 'vram': this.selectedVram.set(value ?? null); break;
      case 'kbSwitch': this.selectedKbSwitch.set(value ?? null); break;
      case 'kbLayout': this.selectedKbLayout.set(value ?? null); break;
      case 'kbConnection': this.selectedKbConnection.set(value ?? null); break;
      case 'mouseDpi': this.selectedMouseDpi.set(value ?? null); break;
      case 'mouseWeight': this.selectedMouseWeight.set(value ?? null); break;
      case 'mouseConnection': this.selectedMouseConnection.set(value ?? null); break;
      default:
        break;
    }
    const qp = this.route.snapshot.queryParamMap;
    const q: Record<string, string | null> = {
      category: qp.get('category') ?? null,
      search: qp.get('search') ?? null,
      brand: qp.get('brand') ?? null,
      price: qp.get('price') ?? null,
      sort: qp.get('sort') ?? null,
      cpu: this.selectedCpu() ?? null,
      gpu: this.selectedGpu() ?? null,
      screenInch: this.selectedScreenInch() ?? null,
      storage: this.selectedStorage() ?? null,
      ram: this.selectedRam() ?? null,
      cpuSeries: this.selectedCpuSeries() ?? null,
      cpuSocket: this.selectedCpuSocket() ?? null,
      cpuCores: this.selectedCpuCores() ?? null,
      mbSocket: this.selectedMbSocket() ?? null,
      mbRamType: this.selectedMbRamType() ?? null,
      mbChipset: this.selectedMbChipset() ?? null,
      ramType: this.selectedRamType() ?? null,
      ramCapacity: this.selectedRamCapacity() ?? null,
      ramBus: this.selectedRamBus() ?? null,
      ssdCapacity: this.selectedSsdCapacity() ?? null,
      ssdInterface: this.selectedSsdInterface() ?? null,
      ssdForm: this.selectedSsdForm() ?? null,
      vgaSeries: this.selectedVgaSeries() ?? null,
      vram: this.selectedVram() ?? null,
      kbSwitch: this.selectedKbSwitch() ?? null,
      kbLayout: this.selectedKbLayout() ?? null,
      kbConnection: this.selectedKbConnection() ?? null,
      mouseDpi: this.selectedMouseDpi() ?? null,
      mouseWeight: this.selectedMouseWeight() ?? null,
      mouseConnection: this.selectedMouseConnection() ?? null,
    };
    this.router.navigate([], {
      queryParams: q,
      queryParamsHandling: 'merge',
      relativeTo: this.route,
    });
  }

  setSort(sort: ProductSort): void {
    this.currentSort.set(sort);
    this.router.navigate([], {
      queryParams: { sort },
      queryParamsHandling: 'merge',
      relativeTo: this.route,
    });
  }

  toggleFilterSection(id: string): void {
    const current = this.openFilterSections();
    this.openFilterSections.set({
      ...current,
      [id]: !current[id],
    });
  }

  isFilterSectionOpen(id: string): boolean {
    const current = this.openFilterSections();
    return !!current[id];
  }

  /** Cuộn tới sidebar bộ lọc (dùng cho nút "Bộ lọc nâng cao" trên mobile). */
  scrollToFilterSidebar(): void {
    const el = document.getElementById('pl-sidebar');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  strId(value: string | number | null | undefined): string {
    return value == null ? '' : String(value);
  }

  loadProducts(reset: boolean): void {
    if (reset) {
      this.page.set(1);
      this.loadingProducts.set(true);
    } else {
      this.loadingMore.set(true);
    }
    const page = reset ? 1 : this.page();
    const range = PRICE_RANGES.find((r) => r.id === this.selectedPriceRangeId());
    const params: {
      page: number;
      limit: number;
      category?: string;
      search?: string;
      brand?: string;
      minPrice?: number;
      maxPrice?: number;
      sort: ProductSort;
      cpu?: string;
      gpu?: string;
      screenInch?: string;
      storage?: string;
      ram?: string;
      cpuSeries?: string;
      cpuSocket?: string;
      cpuCores?: string;
      mbSocket?: string;
      mbRamType?: string;
      mbChipset?: string;
      ramType?: string;
      ramCapacity?: string;
      ramBus?: string;
      ssdCapacity?: string;
      ssdInterface?: string;
      ssdForm?: string;
      vgaSeries?: string;
      vram?: string;
      kbSwitch?: string;
      kbLayout?: string;
      kbConnection?: string;
      mouseDpi?: string;
      mouseWeight?: string;
      mouseConnection?: string;
    } = {
      page,
      limit: this.pageSize,
      sort: this.currentSort(),
    };
    const catId = this.selectedCategoryId();
    if (catId) params.category = catId;
    const cpu = this.selectedCpu(); if (cpu) params.cpu = cpu;
    const gpu = this.selectedGpu(); if (gpu) params.gpu = gpu;
    const screenInch = this.selectedScreenInch(); if (screenInch) params.screenInch = screenInch;
    const storage = this.selectedStorage(); if (storage) params.storage = storage;
    const ram = this.selectedRam(); if (ram) params.ram = ram;
    const cpuSeries = this.selectedCpuSeries(); if (cpuSeries) params.cpuSeries = cpuSeries;
    const cpuSocket = this.selectedCpuSocket(); if (cpuSocket) params.cpuSocket = cpuSocket;
    const cpuCores = this.selectedCpuCores(); if (cpuCores) params.cpuCores = cpuCores;
    const mbSocket = this.selectedMbSocket(); if (mbSocket) params.mbSocket = mbSocket;
    const mbRamType = this.selectedMbRamType(); if (mbRamType) params.mbRamType = mbRamType;
    const mbChipset = this.selectedMbChipset(); if (mbChipset) params.mbChipset = mbChipset;
    const ramType = this.selectedRamType(); if (ramType) params.ramType = ramType;
    const ramCapacity = this.selectedRamCapacity(); if (ramCapacity) params.ramCapacity = ramCapacity;
    const ramBus = this.selectedRamBus(); if (ramBus) params.ramBus = ramBus;
    const ssdCapacity = this.selectedSsdCapacity(); if (ssdCapacity) params.ssdCapacity = ssdCapacity;
    const ssdInterface = this.selectedSsdInterface(); if (ssdInterface) params.ssdInterface = ssdInterface;
    const ssdForm = this.selectedSsdForm(); if (ssdForm) params.ssdForm = ssdForm;
    const vgaSeries = this.selectedVgaSeries(); if (vgaSeries) params.vgaSeries = vgaSeries;
    const vramVal = this.selectedVram(); if (vramVal) params.vram = vramVal;
    const kbSwitch = this.selectedKbSwitch(); if (kbSwitch) params.kbSwitch = kbSwitch;
    const kbLayout = this.selectedKbLayout(); if (kbLayout) params.kbLayout = kbLayout;
    const kbConnection = this.selectedKbConnection(); if (kbConnection) params.kbConnection = kbConnection;
    const mouseDpi = this.selectedMouseDpi(); if (mouseDpi) params.mouseDpi = mouseDpi;
    const mouseWeight = this.selectedMouseWeight(); if (mouseWeight) params.mouseWeight = mouseWeight;
    const mouseConnection = this.selectedMouseConnection(); if (mouseConnection) params.mouseConnection = mouseConnection;
    const search = this.searchTerm().trim();
    if (search) params.search = search;
    const brands = this.selectedBrands();
    if (brands.length) params.brand = brands.join(',');
    if (range?.min != null) params.minPrice = range.min;
    if (range?.max != null) params.maxPrice = range.max;

    this.api.getProducts(params).subscribe({
      next: (res) => {
        if (reset) {
          this.products.set(res.items);
          this.page.set(1);
        } else {
          this.products.update((prev) => [...prev, ...res.items]);
        }
        this.total.set(res.total);
        this.loadingProducts.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loadingProducts.set(false);
        this.loadingMore.set(false);
      },
    });
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore()) return;
    const nextPage = this.page() + 1;
    this.page.set(nextPage);
    this.loadProducts(false);
  }

  productImage(p: Product): string {
    const url = productMainImage(p);
    return url || 'assets/placeholder-product.png';
  }

  displayPrice(p: Product): number {
    return productDisplayPrice(p);
  }

  hasSale(p: Product): boolean {
    return productHasSale(p);
  }

  salePercent(p: Product): number {
    return productSalePercent(p);
  }

  /** Giá hiển thị: "Liên hệ" nếu price = 0, ngược lại format VNĐ. */
  priceLabel(p: Product): string {
    const price = productDisplayPrice(p);
    if (price == null || price <= 0) return 'Liên hệ';
    return price.toLocaleString('vi-VN') + '₫';
  }

  /** Giá gốc (khi giảm) để gạch ngang. */
  oldPriceLabel(p: Product): string {
    if (!this.hasSale(p)) return '';
    const old = p.old_price ?? (p.price ?? 0);
    if (old <= 0) return '';
    return old.toLocaleString('vi-VN') + '₫';
  }

  /** Lấy spec hiển thị cho card từ specs (DATA_STRUCTURE_FOR_UI). */
  getSpecLines(p: Product): { label: string; value: string }[] {
    const specs = (p.specs ?? p.techSpecs ?? {}) as Record<string, string>;
    const keys = ['CPU', 'GPU', 'VGA', 'Card đồ họa', 'RAM', 'Ổ cứng', 'Ổ cứng', 'Nguồn', 'PSU', 'Main', 'Mainboard'];
    const out: { label: string; value: string }[] = [];
    const used = new Set<string>();
    for (const key of keys) {
      const v = specs[key];
      if (v && typeof v === 'string' && !used.has(key)) {
        used.add(key);
        let label = key;
        if (key === 'VGA' || key === 'Card đồ họa') label = 'GPU';
        if (key === 'Main' || key === 'Mainboard') label = 'Main';
        if (key === 'Ổ cứng' || key === 'Ổ cứng') label = 'Ổ';
        out.push({ label, value: v.length > 35 ? v.slice(0, 35) + '…' : v });
      }
    }
    if (out.length > 0) return out;
    if (p.shortDescription) {
      const firstLine = p.shortDescription.split('\n')[0]?.trim().slice(0, 120);
      if (firstLine) return [{ label: '', value: firstLine + (firstLine.length >= 120 ? '…' : '') }];
    }
    return [];
  }

  addToCart(e: Event, p: Product) {
    e.preventDefault();
    e.stopPropagation();

    const btn = e.currentTarget as HTMLElement;
    const card = btn.closest('.pl-card');
    const img = card?.querySelector('.pl-card__img') as HTMLImageElement | null;
    const cartBtn = document.querySelector('.cart-btn') as HTMLElement | null;

    if (img && cartBtn) {
      const imgRect = img.getBoundingClientRect();
      const cartRect = cartBtn.getBoundingClientRect();

      const clone = img.cloneNode(true) as HTMLElement;
      clone.classList.add('fly-to-cart-clone');

      // Khởi tạo vị trí bắt đầu theo ảnh gốc
      clone.style.left = `${imgRect.left}px`;
      clone.style.top = `${imgRect.top}px`;
      clone.style.width = `${imgRect.width}px`;
      clone.style.height = `${imgRect.height}px`;

      document.body.appendChild(clone);

      // Force layout recalculation: Đảm bảo trình duyệt render trạng thái ban đầu để transition hdn hoạt động 
      // Việc đọc offsetWidth bắt buộc browser flush layout
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      clone.offsetWidth;

      // Điểm đến (Cart Icon Header)
      const targetWidth = 30;
      const targetHeight = 30;
      const targetX = cartRect.left + cartRect.width / 2 - targetWidth / 2;
      const targetY = cartRect.top + cartRect.height / 2 - targetHeight / 2;

      // Kích hoạt transition bằng cách đổi style inline
      clone.style.left = `${targetX}px`;
      clone.style.top = `${targetY}px`;
      clone.style.width = `${targetWidth}px`;
      clone.style.height = `${targetHeight}px`;
      clone.style.opacity = '0.4';
      clone.style.borderRadius = '50%';

      // Dọn dẹp DOM khi xong transition
      setTimeout(() => {
        clone.remove();
        cartBtn.classList.remove('cart-bump');
        // Force reflow nhẹ để class animation áp dụng lại
        void cartBtn.offsetWidth;
        cartBtn.classList.add('cart-bump');
      }, 700); // 700ms khớp thông số transition css
    }

    this.cart.add(p);
  }

  // --- Helpers cho UI mới ---
  getRating(p: Product): { stars: number; count: number } {
    // Nếu có dữ liệu thật thì dùng, không thì random 4.0 - 5.0
    if (p.rating != null && p.reviewCount != null) {
      return { stars: p.rating, count: p.reviewCount };
    }
    // Hash nhẹ từ id để cố định số sao cho mỗi sản phẩm (không nhảy lung tung khi reload)
    const seed = (p._id ?? p.name).charCodeAt(0) + (p.price ?? 0);
    const stars = 4 + (seed % 11) / 10; // 4.0 -> 5.0
    const count = 10 + (seed % 90); // 10 -> 99 đánh giá
    return { stars, count };
  }

  getStarArray(rating: number): number[] {
    // Trả về mảng 5 phần tử: 1=full, 0.5=half, 0=empty
    const arr: number[] = [];
    for (let i = 1; i <= 5; i++) {
      if (rating >= i) arr.push(1);
      else if (rating >= i - 0.5) arr.push(0.5);
      else arr.push(0);
    }
    return arr;
  }

  getFeatureIcons(p: Product): { icon: string; value: string; label: string }[] {
    const specs = (p.specs ?? p.techSpecs ?? {}) as Record<string, string>;
    const feats: { icon: string; value: string; label: string }[] = [];

    // 1. CPU
    const cpu = specs['CPU'] || specs['Vi xử lý'];
    if (cpu) {
      // Chỉ lấy tên ngắn gọn: "Ultra 7 155H", "i5-12400F", "Ryzen 5 7600"
      let val = cpu.replace(/Intel|AMD|Processor|Core|Ryzen/gi, '').trim();
      val = val.split(',')[0].split('(')[0].trim(); // Bỏ phần sau ',' hoặc '('
      if (val.length > 15) val = val.substring(0, 15) + '..';
      feats.push({ icon: 'cpu', label: 'CPU', value: val });
    }

    // 2. VGA/GPU
    const vga = specs['VGA'] || specs['GPU'] || specs['Card đồ họa'];
    if (vga) {
      let val = vga.replace(/NVIDIA|GeForce|AMD|Radeon|Graphics/gi, '').trim();
      val = val.split(',')[0].split('(')[0].trim();
      if (val.length > 15) val = val.substring(0, 15) + '..';
      feats.push({ icon: 'gpu', label: 'VGA', value: val });
    }

    // 3. RAM
    const ram = specs['RAM'] || specs['Bộ nhớ trong'];
    if (ram) {
      const gb = ram.match(/(\d+\s*GB)/i);
      const val = gb ? gb[1] : ram.split(' ')[0];
      feats.push({ icon: 'ram', label: 'RAM', value: val });
    }

    // 4. SSD/HDD
    const disk = specs['Ổ cứng'] || specs['Storage'] || specs['Dung lượng'];
    if (disk) {
      const cap = disk.match(/(\d+\s*(GB|TB))/i);
      const val = cap ? cap[1] : disk.split(' ')[0];
      feats.push({ icon: 'disk', label: 'Ổ cứng', value: val });
    }

    // 5. Màn hình
    const screen = specs['Màn hình'] || specs['Kích thước màn hình'];
    if (screen) {
      const size = screen.match(/(\d+(\.\d+)?)\s*(inch|")/i);
      let val = '';
      if (size) val += size[1] + '"';
      const hz = screen.match(/(\d+)\s*Hz/i);
      if (hz) val += ' ' + hz[1] + 'Hz'; // Thêm Hz nếu có
      if (!val) val = screen.split(',')[0];
      feats.push({ icon: 'screen', label: 'Màn', value: val });
    }

    return feats.slice(0, 5); // Tối đa 5 icon
  }
}
