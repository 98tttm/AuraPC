import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, Product, FilterOptionsResponse, productMainImage } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';

const STEP_TO_CATEGORY: Record<string, string> = {
    'GPU': 'vga', 'CPU': 'cpu', 'MB': 'mainboard', 'CASE': 'case-may-tinh',
    'COOLING': 'tan-nhiet-cpu', 'MEMORY': 'ram', 'STORAGE': 'ssd', 'PSU': 'nguon-psu',
    'FANS': 'quat-case', 'MONITOR': 'man-hinh', 'KEYBOARD': 'ban-phim-may-tinh',
    'MOUSE': 'chuot-may-tinh', 'HEADSET': 'tai-nghe-may-tinh',
};

/** Placeholder cho từng loại filter khi chưa chọn */
const FILTER_PLACEHOLDER: Record<string, string> = {
    vgaSeries: 'Model',
    vram: 'VRAM',
    cpuSeries: 'Tất cả dòng CPU',
    mbSocket: 'Tất cả socket',
    mbChipset: 'Tất cả chipset',
    ramType: 'Tất cả loại RAM',
    ramCapacity: 'Tất cả dung lượng',
    ssdCapacity: 'Tất cả dung lượng',
    ssdInterface: 'Tất cả giao tiếp',
    screenInch: 'Kích thước màn hình',
    kbSwitch: 'Loại switch',
    kbLayout: 'Bố cục',
    mouseDpi: 'DPI',
    mouseConnection: 'Kết nối',
};

/** Bộ lọc theo từng bước - key API params */
const STEP_FILTERS: Record<string, { label: string; param: string }[]> = {
    'GPU': [
        { label: 'Model', param: 'vgaSeries' },
        { label: 'VRAM', param: 'vram' },
    ],
    'CPU': [{ label: 'Dòng CPU', param: 'cpuSeries' }],
    'MB': [
        { label: 'Socket', param: 'mbSocket' },
        { label: 'Chipset', param: 'mbChipset' },
    ],
    'MEMORY': [
        { label: 'Loại RAM', param: 'ramType' },
        { label: 'Dung lượng', param: 'ramCapacity' },
    ],
    'STORAGE': [
        { label: 'Dung lượng', param: 'ssdCapacity' },
        { label: 'Giao tiếp', param: 'ssdInterface' },
    ],
    'MONITOR': [{ label: 'Kích thước', param: 'screenInch' }],
    'KEYBOARD': [
        { label: 'Switch', param: 'kbSwitch' },
        { label: 'Bố cục', param: 'kbLayout' },
    ],
    'MOUSE': [
        { label: 'DPI', param: 'mouseDpi' },
        { label: 'Kết nối', param: 'mouseConnection' },
    ],
};

@Component({
    selector: 'app-aura-builder',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './aura-builder.component.html',
    styleUrl: './aura-builder.component.css',
})
export class AuraBuilderComponent {
    private api = inject(ApiService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cart = inject(CartService);
    private auth = inject(AuthService);
    private http = inject(HttpClient);

    readonly steps = ['GPU', 'CPU', 'MB', 'CASE', 'COOLING', 'MEMORY', 'STORAGE', 'PSU', 'FANS', 'MONITOR', 'KEYBOARD', 'MOUSE', 'HEADSET'];

    currentStep = signal<string>('');
    isBuilderMode = signal(false);
    products = signal<Product[]>([]);
    total = signal(0);
    loading = signal(false);
    searchTerm = signal('');
    selectedBrand = signal<string | null>(null);
    selectedFilterValues = signal<Record<string, string>>({});
    selectedProduct = signal<Product | null>(null);

    builderId = signal<string | null>(null);
    builderShareId = signal<string | null>(null);
    savedConfig = signal<Record<string, unknown>>({});

    showSaveModal = signal(false);
    saveModalEmail = signal('');
    saveModalLoading = signal(false);
    saveModalError = signal<string | null>(null);
    toastMessage = signal<string | null>(null);

    private categoryByStep = signal<Record<string, string>>({});
    filterOptions = signal<FilterOptionsResponse | null>(null);

    /** Lấy brands từ filter-options (API) để luôn có options ngay cả khi filter trả 0 sản phẩm */
    brands = computed(() => {
        const opts = this.filterOptions();
        const fromOpts = opts?.brands ?? [];
        const set = new Set<string>(fromOpts.filter((b) => (b ?? '').trim()));
        this.products().forEach((p) => {
            const b = (p.brand ?? '').trim();
            if (b) set.add(b);
        });
        if (this.currentStep() === 'GPU') {
            ['ASUS', 'GIGABYTE', 'MSI'].forEach((b) => set.add(b));
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    });

    /** Bộ lọc áp dụng cho bước hiện tại */
    stepFilters = computed(() => STEP_FILTERS[this.currentStep()] ?? []);

    /** Options cho từng filter - chuẩn hóa và sắp xếp */
    getFilterOptionsFor = (param: string): string[] => {
        const opts = this.filterOptions();
        if (!opts?.specs) return [];
        const arr = opts.specs[param as keyof typeof opts.specs];
        if (!Array.isArray(arr) || arr.length === 0) return [];
        const unique = [...new Set(arr.map((s) => (s || '').trim()).filter(Boolean))];
        if (param === 'vgaSeries') return this.sortVgaSeries(unique);
        if (param === 'vram' || param === 'ramCapacity' || param === 'ssdCapacity')
            return unique.sort((a, b) => this.numericCompare(a, b));
        return unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    };

    private numericCompare(a: string, b: string): number {
        const numA = parseFloat(a.replace(/[^\d.]/g, ''));
        const numB = parseFloat(b.replace(/[^\d.]/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b, undefined, { numeric: true });
    }

    /** Sắp xếp VGA: NVIDIA RTX 50 > RTX 40 > RTX 30, AMD RX 7000 > RX 6000... */
    private sortVgaSeries(items: string[]): string[] {
        const extract = (s: string) => {
            const nv = s.match(/(?:RTX|GTX)\s*(\d{4,5})/i);
            const amd = s.match(/RX\s*(\d{4,5})/i);
            if (nv) return { vendor: 1, num: parseInt(nv[1], 10), raw: s };
            if (amd) return { vendor: 2, num: parseInt(amd[1], 10), raw: s };
            return { vendor: 3, num: 0, raw: s };
        };
        return items.sort((a, b) => {
            const x = extract(a);
            const y = extract(b);
            if (x.vendor !== y.vendor) return x.vendor - y.vendor;
            return y.num - x.num;
        });
    }

    getSelectedFilter = (param: string): string | null =>
        this.selectedFilterValues()[param] || null;

    getFilterPlaceholder = (param: string): string =>
        FILTER_PLACEHOLDER[param] ?? 'Tất cả';

    hasFilters = computed(() => {
        const term = this.searchTerm().trim();
        const brand = this.selectedBrand();
        const filters = this.selectedFilterValues();
        if (term || brand) return true;
        return Object.values(filters).some((v) => !!v);
    });

    /** Bước hiện tại */
    isStepCurrent = (step: string) => this.currentStep() === step;

    /** Bước đã chọn sản phẩm (để hiện trắng sáng hơn) */
    isStepCompleted = (step: string) => !!(this.savedConfig()[step] as { product?: string } | undefined)?.product;

    /** Tất cả bước đã chọn xong - hiện trang Overview */
    isAllStepsCompleted = () => this.steps.every((s) => !!(this.savedConfig()[s] as { product?: string } | undefined)?.product);

    /** Bước có thể truy cập: chỉ bước đã hoàn thành hoặc bước tiếp theo chưa hoàn thành đầu tiên */
    isStepAccessible = (step: string): boolean => {
        if (!this.isBuilderMode()) return false;
        const idx = this.steps.indexOf(step);
        if (idx < 0) return false;
        // Completed steps are always accessible (allows going back to modify)
        if (this.isStepCompleted(step)) return true;
        // The first incomplete step is accessible
        const firstIncompleteIdx = this.steps.findIndex((s) => !this.isStepCompleted(s));
        return idx === firstIncompleteIdx;
    };

    /** Bước bị khóa (chưa hoàn thành bước trước đó) */
    isStepLocked = (step: string): boolean => {
        if (!this.isBuilderMode()) return true;
        return !this.isStepAccessible(step);
    };

    /** Chuyển đến bước (click sidebar khi ở builder mode) */
    goToStep(step: string) {
        if (!this.isBuilderMode()) return;
        if (step === 'OVERVIEW') {
            this.currentStep.set('OVERVIEW');
            return;
        }
        if (!this.steps.includes(step)) return;
        // Enforce step locking: chỉ cho phép bước đã hoàn thành hoặc bước tiếp theo
        if (!this.isStepAccessible(step)) return;
        this.currentStep.set(step);
        this.selectedProduct.set(null);
        this.clearFilters();
        this.loadProducts();
    }

    /** Có thể NEXT khi đã chọn sản phẩm (builder ID sẽ được tạo nếu chưa có) */
    canGoNext = computed(() => !!this.selectedProduct());

    constructor() {
        this.api.getCategories().subscribe({
            next: (list) => {
                const map: Record<string, string> = {};
                const keywords: Record<string, string[]> = {
                    GPU: ['vga', 'card đồ họa'], CPU: ['cpu', 'vi xu ly'], MB: ['mainboard', 'main'],
                    CASE: ['case', 'vo case', 'case-may-tinh'], COOLING: ['tan nhiet', 'tan-nhiet-cpu', 'cooling'], MEMORY: ['ram'],
                    STORAGE: ['ssd', 'o cung'], PSU: ['nguon', 'nguon-psu'], FANS: ['quat', 'quat-case'],
                    MONITOR: ['man hinh', 'man-hinh'], KEYBOARD: ['ban phim', 'ban-phim-may-tinh'],
                    MOUSE: ['chuot', 'chuot-may-tinh'], HEADSET: ['tai nghe', 'tai-nghe-may-tinh'],
                };
                for (const step of this.steps) {
                    const fallback = STEP_TO_CATEGORY[step];
                    const keys = keywords[step] ?? [step.toLowerCase()];
                    const found = list.find((c) => {
                        const name = ((c.name ?? '') + ' ' + (c.slug ?? '')).toLowerCase();
                        const slug = (c.slug ?? c.category_id ?? '').toLowerCase();
                        return keys.some((k) => name.includes(k) || slug.includes(k)) || slug === fallback;
                    });
                    map[step] = found ? (found.slug ?? found.category_id ?? fallback) : fallback;
                }
                this.categoryByStep.set(map);
            },
        });

        this.route.paramMap.subscribe((params) => {
            const id = params.get('id');
            if (id) {
                this.api.getBuilder(id).subscribe({
                    next: (b) => {
                        this.builderId.set(b._id);
                        this.builderShareId.set(b.shareId ?? null);
                        this.savedConfig.set(b.components || {});
                        this.isBuilderMode.set(true);
                        const firstEmpty = this.steps.find((s) => !(b.components || {})[s]);
                        if (firstEmpty) {
                            this.currentStep.set(firstEmpty);
                            this.loadProducts();
                        } else {
                            this.currentStep.set('OVERVIEW');
                        }
                    },
                    error: () => this.router.navigate(['/aura-builder']),
                });
            }
        });
    }

    isOverview = () => !this.isBuilderMode();

    goOverview() {
        this.currentStep.set('');
        if (this.isBuilderMode()) {
            this.isBuilderMode.set(false);
            const id = this.builderShareId() || this.builderId();
            if (id && this.router.url.includes(id)) {
                this.router.navigate(['/aura-builder'], { replaceUrl: true });
            }
        }
    }

    startOver() {
        this.currentStep.set('');
        this.isBuilderMode.set(false);
        this.selectedProduct.set(null);
        this.builderId.set(null);
        this.builderShareId.set(null);
        this.savedConfig.set({});
        this.router.navigate(['/aura-builder']);
        // Automatically create a new builder
        this.planYourBuild();
    }

    planYourBuild() {
        if (!this.auth.currentUser()) {
            this.auth.showLoginPopup$.next();
            return;
        }

        this.selectedProduct.set(null);
        this.api.createBuilder().subscribe({
            next: (res) => {
                this.builderId.set(res._id);
                this.builderShareId.set(res.shareId);
                this.savedConfig.set({});
                this.isBuilderMode.set(true);
                this.currentStep.set('GPU');
                this.router.navigate(['/aura-builder', res.shareId], { replaceUrl: true });
                this.loadProducts();
            },
            error: (err) => {
                console.error('[AuraBuilder] Không tạo được cấu hình:', err);
                const msg = err?.error?.error ?? err?.message ?? 'Không kết nối được server. Vui lòng khởi động server (cd server && npm start) và thử lại.';
                alert(msg);
            },
        });
    }

    loadProducts() {
        const step = this.currentStep();
        if (!step || step === 'OVERVIEW') return;

        const map = this.categoryByStep();
        const catSlug = map[step] ?? STEP_TO_CATEGORY[step];

        this.loading.set(true);
        const params: Record<string, unknown> = {
            category: catSlug || undefined,
            search: this.searchTerm().trim() || undefined,
            brand: this.selectedBrand() || undefined,
            limit: 24,
            page: 1,
        };
        const filters = this.selectedFilterValues();
        for (const [param, value] of Object.entries(filters)) {
            if (value) (params as Record<string, string>)[param] = value;
        }

        this.api.getProducts(params).subscribe({
            next: (res) => {
                this.products.set(res.items);
                this.total.set(res.total);
                this.loading.set(false);
                // Khi back về bước cũ: preselect sản phẩm đã lưu (nếu có trong danh sách)
                const saved = this.savedConfig()[step] as { product?: string } | undefined;
                const prodId = saved?.product;
                if (prodId && res.items?.length) {
                    const found = res.items.find((p) => String(p._id) === String(prodId));
                    if (found) this.selectedProduct.set(found);
                    else this.selectedProduct.set(null);
                } else {
                    this.selectedProduct.set(null);
                }
            },
            error: () => this.loading.set(false),
        });

        if (catSlug) {
            this.api.getFilterOptions(catSlug).subscribe({
                next: (opts) => this.filterOptions.set(opts),
            });
        }
    }

    onSearch(value: string) {
        this.searchTerm.set(value);
        this.loadProducts();
    }

    onBrandChange(value: string) {
        this.selectedBrand.set(value || null);
        this.loadProducts();
    }

    onFilterChange(param: string, value: string) {
        const curr = this.selectedFilterValues();
        const next = { ...curr };
        if (value) next[param] = value;
        else delete next[param];
        this.selectedFilterValues.set(next);
        this.loadProducts();
    }

    clearFilters() {
        this.searchTerm.set('');
        this.selectedBrand.set(null);
        this.selectedFilterValues.set({});
        this.loadProducts();
    }

    selectProduct(p: Product) {
        this.selectedProduct.set(p);
    }

    nextLoading = signal(false);

    goNext() {
        const prod = this.selectedProduct();
        if (!prod) return;

        const step = this.currentStep();
        let id = this.builderId() || this.builderShareId();
        if (!id) {
            this.nextLoading.set(true);
            this.api.createBuilder().subscribe({
                next: (res) => {
                    this.builderId.set(res._id);
                    this.builderShareId.set(res.shareId);
                    this.savedConfig.set({});
                    this.router.navigate(['/aura-builder', res.shareId], { replaceUrl: true });
                    this.nextLoading.set(false);
                    this.doGoNext(prod, step, res._id);
                },
                error: (err) => {
                    this.nextLoading.set(false);
                    console.error('[AuraBuilder] Không tạo được cấu hình:', err);
                    alert('Không kết nối được server. Vui lòng khởi động server và thử lại.');
                },
            });
            return;
        }
        this.doGoNext(prod, step, id);
    }

    private doGoNext(prod: Product, step: string, id: string) {
        const productPayload = {
            _id: prod._id != null ? String(prod._id) : undefined,
            name: prod.name ?? '',
            slug: prod.slug ?? '',
            price: prod.price ?? 0,
            images: prod.images,
            specs: prod.specs,
            techSpecs: prod.techSpecs,
        };

        this.nextLoading.set(true);
        this.api.updateBuilderComponent(id, step, productPayload).subscribe({
            next: (res) => {
                this.nextLoading.set(false);
                const cfg = this.savedConfig();
                cfg[step] = { product: prod._id, name: prod.name, slug: prod.slug, price: prod.price };
                this.savedConfig.set({ ...cfg });
                if (res?.components) this.savedConfig.set(res.components as Record<string, unknown>);
                const idx = this.steps.indexOf(step);
                if (idx >= 0 && idx < this.steps.length - 1) {
                    this.currentStep.set(this.steps[idx + 1]);
                    this.selectedProduct.set(null);
                    this.clearFilters();
                    this.loadProducts();
                } else if (step === 'HEADSET') {
                    this.currentStep.set('OVERVIEW');
                }
            },
            error: (err) => {
                this.nextLoading.set(false);
                console.error('[AuraBuilder] Lỗi lưu:', err);
                alert('Không lưu được. Kiểm tra kết nối server hoặc thử lại.');
            },
        });
    }

    copyShareLink() {
        const shareId = this.builderShareId();
        if (!shareId) return;
        const url = window.location.origin + '/aura-builder/' + shareId;
        navigator.clipboard.writeText(url).then(() => {
            this.showToast('Đã sao chép liên kết chia sẻ!');
        });
    }

    // ==========================================
    // AURAVISUAL N8N INTEGRATION
    // ==========================================
    showVisualModal = signal(false);
    visualLoading = signal(false);
    visualImageUrl = signal<string | null>(null);
    visualError = signal<string | null>(null);

    triggerAuraVisual() {
        const components = this.overviewComponents();
        if (!components.length) {
            this.showToast('Vui lòng chọn ít nhất một linh kiện để sử dụng AuraVisual.');
            return;
        }

        const payload = {
            components: components.map((c) => ({
                type: c.step,
                name: c.data?.name || 'Unknown',
                image: this.getComponentImage(c.data), // Thêm ảnh vào payload cho AI Nano Banana
            })),
        };

        this.showVisualModal.set(true);
        this.visualLoading.set(true);
        this.visualError.set(null);
        this.visualImageUrl.set(null);

        console.log('[AuraVisual] Step-by-step raw config:', this.savedConfig());
        console.log('[AuraVisual] Processed overview components:', components);
        console.log('[AuraVisual] Final payload to n8n Webhook:', payload);


        // Gọi tới n8n webhook thực tế
        this.http.post<any>('https://thinhn8n.io.vn/webhook/auravisual-trigger', payload).subscribe({
            next: (res) => {
                console.log('[AuraVisual] Response from n8n:', res);
                if (res && res.imageUrl) {
                    this.visualImageUrl.set(res.imageUrl);
                } else if (res && typeof res === 'string') {
                    // Trong trường hợp n8n trả về plain text là URL
                    if (res.startsWith('http')) {
                        this.visualImageUrl.set(res);
                    } else {
                        this.visualError.set('AuraVisual trả về định dạng không hợp lệ.');
                    }
                } else {
                    this.visualError.set('AuraVisual không trả về hình ảnh.');
                }
                this.visualLoading.set(false);
            },
            error: (err) => {
                console.error('[AuraVisual] Error from n8n:', err);
                // Dùng Mockup ảnh đã gen local để DEMO cho người dùng nếu API n8n bị lỗi (do thiếu API Key)
                this.showToast('Demo Mode: Chưa kích hoạt Replicate Token trong n8n. Hiển thị ảnh Demo AI.');
                this.visualImageUrl.set('assets/mock_auravisual.png');
                this.visualLoading.set(false);
            }
        });
    }

    closeVisualModal() {
        this.showVisualModal.set(false);
    }

    onSaveConfiguration() {
        if (!this.builderShareId() && !this.builderId()) return;
        this.saveModalEmail.set('');
        this.saveModalError.set(null);
        this.showSaveModal.set(true);
    }

    closeSaveModal() {
        this.showSaveModal.set(false);
        this.saveModalError.set(null);
    }

    showToast(msg: string) {
        this.toastMessage.set(msg);
        setTimeout(() => this.toastMessage.set(null), 3000);
    }

    sendConfigEmail() {
        const email = this.saveModalEmail().trim();
        if (!email || !email.includes('@')) {
            this.saveModalError.set('Vui lòng nhập email hợp lệ.');
            return;
        }
        const id = this.builderShareId() || this.builderId();
        if (!id) return;
        this.saveModalLoading.set(true);
        this.saveModalError.set(null);
        this.api.emailBuilderPdf(id, email).subscribe({
            next: () => {
                this.saveModalLoading.set(false);
                this.closeSaveModal();
                this.showToast('Đã gửi');
            },
            error: (err) => {
                this.saveModalLoading.set(false);
                const msg = err?.error?.error ?? err?.message ?? 'Không gửi được email. Kiểm tra cấu hình server (EMAIL_USER, EMAIL_PASS).';
                this.saveModalError.set(msg);
            },
        });
    }

    /** Nhãn hiển thị ở sidebar - tiếng Việt, GPU → VGA */
    getStepLabel(step: string): string {
        const map: Record<string, string> = {
            GPU: 'VGA',
            CPU: 'CPU',
            MB: 'Bo mạch chủ',
            CASE: 'Vỏ case',
            COOLING: 'Tản nhiệt',
            MEMORY: 'RAM',
            STORAGE: 'Ổ cứng',
            PSU: 'Nguồn',
            FANS: 'Quạt',
            MONITOR: 'Màn hình',
            KEYBOARD: 'Bàn phím',
            MOUSE: 'Chuột',
            HEADSET: 'Tai nghe',
        };
        return map[step] ?? step;
    }

    getStepTitleVi(): Record<string, string> {
        return {
            GPU: 'Card màn hình',
            CPU: 'Vi xử lý',
            MB: 'Bo mạch chủ',
            CASE: 'Vỏ case',
            COOLING: 'Tản nhiệt',
            MEMORY: 'RAM',
            STORAGE: 'Ổ cứng',
            PSU: 'Nguồn',
            FANS: 'Quạt',
            MONITOR: 'Màn hình',
            KEYBOARD: 'Bàn phím',
            MOUSE: 'Chuột',
            HEADSET: 'Tai nghe',
            'OVERVIEW': 'Tổng quan',
        };
    }

    /** Lấy components đã chọn cho trang Overview */
    overviewComponents = computed(() => {
        const cfg = this.savedConfig();
        return this.steps
            .map((step) => ({ step, data: cfg[step] as { product?: string; name?: string; slug?: string; price?: number; images?: unknown[] } | undefined }))
            .filter((x) => x.data?.product);
    });

    /** Cột trái Corsair: GPU, CPU, MB (lựa chọn linh kiện chính) */
    overviewCoreComponents = computed(() => this.overviewComponents().filter((x) => ['GPU', 'CPU', 'MB'].includes(x.step)));

    /** Cột giữa Corsair: phần còn lại (xem trước đơn hàng) */
    overviewOrderPreview = computed(() => this.overviewComponents().filter((x) => !['GPU', 'CPU', 'MB'].includes(x.step)));

    /** Tổng tiền cấu hình */
    overviewTotal = computed(() => {
        return this.overviewComponents().reduce((sum, { data }) => sum + ((data?.price as number) ?? 0), 0);
    });

    /** Lấy ảnh từ component đã lưu */
    getComponentImage(data?: { images?: unknown[] } | null): string {
        const imgs = data?.images;
        if (!imgs?.length) return 'assets/placeholder-product.png';
        const first = imgs[0];
        return typeof first === 'string' ? first : (first as { url?: string })?.url ?? 'assets/placeholder-product.png';
    }

    formatPriceNumber(price: number): string {
        if (price <= 0) return 'Liên hệ';
        return price.toLocaleString('vi-VN') + '₫';
    }

    getStepTitle(step: string): string {
        return this.getStepTitleVi()[step] ?? step;
    }

    getProductImage(p: Product): string {
        const url = productMainImage(p);
        return url || 'assets/placeholder-product.png';
    }

    formatPrice(p: Product): string {
        const price = p?.price ?? 0;
        if (price <= 0) return 'Liên hệ';
        return price.toLocaleString('vi-VN') + '₫';
    }

    getSpecLines(p: Product): { label: string; value: string }[] {
        const specs = (p?.specs ?? p?.techSpecs ?? {}) as Record<string, string>;
        const keys = ['GPU', 'Card đồ họa', 'CPU', 'Memory Size', 'VRAM', 'Dung lượng', 'Interface', 'Chuẩn giao tiếp', 'Socket', 'Chipset'];
        const out: { label: string; value: string }[] = [];
        const labelMap: Record<string, string> = {
            GPU: 'VGA', 'Card đồ họa': 'VGA', 'Graphics Processing': 'Chip đồ họa',
            'Memory Size': 'Bộ nhớ', 'VRAM': 'VRAM', 'Dung lượng': 'Dung lượng',
            'Interface': 'Giao tiếp', 'Chuẩn giao tiếp': 'Giao tiếp',
            'Bộ xử lý đồ họa': 'Chip đồ họa',
        };
        for (const key of Object.keys(specs)) {
            const v = specs[key];
            if (v && typeof v === 'string') {
                const label = labelMap[key] ?? key;
                out.push({ label, value: v });
            }
        }
        return out.slice(0, 6);
    }

    /** Add all overview components to cart */
    addAllToCart() {
        const components = this.overviewComponents();
        if (!components.length) {
            this.showToast('Chưa có linh kiện nào được chọn.');
            return;
        }
        let addedCount = 0;
        for (const item of components) {
            const data = item.data as { product?: string; name?: string; slug?: string; price?: number; images?: unknown[]; _id?: string } | undefined;
            if (data?.product) {
                const product: Product = {
                    _id: data.product,
                    product_id: data.product,
                    name: data.name ?? '',
                    slug: data.slug ?? '',
                    price: data.price ?? 0,
                    images: data.images ?? [],
                } as Product;
                this.cart.add(product);
                addedCount++;
            }
        }
        if (addedCount > 0) {
            this.showToast(`Đã thêm ${addedCount} linh kiện vào giỏ hàng!`);
        }
    }
}
