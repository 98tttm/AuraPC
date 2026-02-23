import {
  Component, ChangeDetectionStrategy, signal, computed, inject, OnDestroy, ViewChildren, QueryList,
  HostListener, Inject, PLATFORM_ID, ElementRef, ViewChild,
} from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, of, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, map, tap, catchError } from 'rxjs/operators';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ApiService, Category, Product, productMainImage } from '../../core/services/api.service';
import { environment } from '../../../environments/environment';

export interface PartnerLink {
  img: string;
  url: string;
  alt: string;
}

export interface MegamenuColumn {
  icon: string;
  title: string;
  /** Slug/category_id danh mục → /san-pham?category=slug */
  categoryId: string;
  items: { label: string; route: string; queryParams?: Record<string, string | null | undefined> }[];
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent implements OnDestroy {
  @ViewChild('navMenuRef') navMenuRef!: ElementRef<HTMLUListElement>;
  @ViewChild('searchWrapRef') searchWrapRef!: ElementRef<HTMLElement>;
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  activeMenu = signal<string>('products');
  isScrolled = signal<boolean>(false);
  /** Header ẩn khi cuộn xuống, hiện khi cuộn lên hoặc hover mép trên viewport */
  headerVisible = signal<boolean>(true);
  menuOpen = signal<boolean>(false);
  searchOpen = signal<boolean>(false);
  searchQuery = signal<string>('');
  searchResults = signal<Product[]>([]);
  searchLoading = signal<boolean>(false);
  searchDropdownVisible = signal<boolean>(false);

  // Lấy ảnh chính cho giỏ hàng
  getMainImage(p: Product): string {
    return productMainImage(p);
  }

  // Dropdowns
  userDropdownOpen = signal<boolean>(false);
  cartDropdownOpen = signal<boolean>(false);

  showLoginPopup = signal<boolean>(false);
  loginPhone = signal<string>('');
  /** Bước đăng nhập: phone | otp */
  loginStep = signal<'phone' | 'otp'>('phone');
  phoneError = signal<string | null>(null);
  otpError = signal<string | null>(null);
  /** Chuỗi 6 ký tự OTP */
  otpValue = signal<string>('');
  /** Timestamp hết hạn OTP (ms) */
  otpExpiresAt = signal<number>(0);
  /** Số giây còn lại (cập nhật mỗi giây) */
  otpCountdownSeconds = signal<number>(0);
  /** Hiển thị trạng thái OTP đúng trước khi đóng popup */
  loginSuccess = signal<boolean>(false);
  /** Bắt đầu animation đóng overlay (sau khi đã hiện xanh OTP) */
  overlayClosing = signal<boolean>(false);
  navHoveredId = signal<string | null>(null);
  navIndicatorLeft = signal<number>(0);
  navIndicatorWidth = signal<number>(0);

  countdownText = computed(() => {
    const s = this.otpCountdownSeconds();
    if (s <= 0) return '0 phút 0 giây';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m} phút ${sec} giây`;
  });

  /** Tên hiển thị bên cạnh icon user: fullName hoặc SĐT (format 0xxxxxxxxx) */
  userDisplayName = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return '';
    const name = u.profile?.fullName?.trim();
    if (name) return name;
    return this.formatPhoneForDisplay(u.phoneNumber);
  });

  private cart = inject(CartService);
  private router = inject(Router);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private api = inject(ApiService);
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private searchSubject = new Subject<string>();
  private searchSub: Subscription | null = null;
  private loginPopupSub: Subscription | null = null;
  private cartAddSub: Subscription | null = null;
  private isBrowser = false;
  private lastScrollY = 0;
  private readonly HEADER_HIDE_THRESHOLD = 120;
  private readonly HOVER_SHOW_ZONE = 80;

  readonly assets = {
    logo: 'assets/c8c67b26bfbd0df3a88be06bec886fd8bd006e7d.png',
    loginLogo: 'assets/LOGO/logo152238.png',
    facebookLogo: 'assets/LOGO/facebook.png',
  };

  readonly menuItems = [
    { id: 'products', label: 'SẢN PHẨM', route: '/san-pham' },
    { id: 'guide', label: 'HƯỚNG DẪN', route: '/' },
    { id: 'aura-builder', label: 'AURA BUILDER', route: '/aura-builder' },
    { id: 'auralab', label: 'AURALAB', route: '/' },
    { id: 'support', label: 'HỖ TRỢ', route: '/' },
  ];

  /** Megamenu: 7 cột – Laptop, PC, Màn hình, Linh Kiện, Gaming Gear, Phụ kiện, Bàn - Ghế. */
  readonly megamenuIcons = {
    laptop: 'assets/logotech/laptop.png',
    pcComponents: 'https://assets.corsair.com/image/upload/f_auto,q_85,w_200,h_200/v1716316771/akamai/icons/png/nav_components_icon.png',
    gamingGear: 'https://assets.corsair.com/image/upload/f_auto,q_85,w_200,h_200/v1716316972/akamai/icons/png/nav_peripherals_icon.png',
    gamingFurniture: 'https://assets.corsair.com/image/upload/f_auto,q_85,w_200,h_200/v1716316771/akamai/icons/png/nav_gamingdesk_icon.png',
    shop: 'https://assets.corsair.com/image/upload/f_auto,q_85,w_200,h_200/v1716316772/akamai/icons/png/nav_shoppingcart_icon.png',
  };

  megamenuColumns = signal<MegamenuColumn[]>([]);
  productsDropdownOpen = signal(false);
  private closeProductsTimer: ReturnType<typeof setTimeout> | null = null;

  readonly partnerLinks: PartnerLink[] = [
    { img: 'assets/ba2a506d58ea6a7e6fa0192d6e841831806c3981.png', url: 'https://drop.com/home', alt: 'Drop' },
    { img: 'assets/0e69c190680bbaf4eabbd6a9fcd7403ed66c1741.png', url: 'https://www.fanatec.com/eu/en', alt: 'Fanatec' },
    { img: 'assets/04ff4911162dc0c16135d97b21dcad117192621b.png', url: 'https://www.corsair.com/us/en', alt: 'Corsair' },
    { img: 'assets/5a7d80d715d44d479e3f007c460888c8a8c24722.png', url: 'https://www.originpc.com/', alt: 'Origin PC' },
  ];

  cartCount = this.cart.cartCount;
  cartItems = computed(() => this.cart.getItems());

  private userDropdownTimer: ReturnType<typeof setTimeout> | null = null;
  private cartDropdownTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.buildMegamenu();
    this.setupSearch();
    this.setupLoginPopupTrigger();
    this.setupCartAddListener();
  }

  private setupCartAddListener(): void {
    this.cartAddSub = this.cart.itemAdded$.subscribe(() => {
      this.headerVisible.set(true);
      if (this.cartDropdownTimer) clearTimeout(this.cartDropdownTimer);
      this.cartDropdownOpen.set(true);
      this.cartDropdownTimer = setTimeout(() => {
        this.cartDropdownOpen.set(false);
      }, 3000);
    });
  }

  private setupLoginPopupTrigger(): void {
    this.loginPopupSub = this.auth.showLoginPopup$.subscribe(() => {
      this.showLoginPopup.set(true);
    });
  }

  private setupSearch(): void {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(280),
      distinctUntilChanged(),
      switchMap((q) => {
        const trimmed = (q || '').trim();
        if (!trimmed || trimmed.length < 1) {
          this.searchResults.set([]);
          this.searchLoading.set(false);
          this.searchDropdownVisible.set(false);
          return of([]);
        }
        this.searchDropdownVisible.set(true);
        this.searchLoading.set(true);
        return this.api.getProducts({ search: trimmed, limit: 8 }).pipe(
          map((res) => res?.items ?? []),
          tap(() => this.searchLoading.set(false)),
          catchError(() => {
            this.searchResults.set([]);
            this.searchLoading.set(false);
            return of([]);
          }),
        );
      }),
    ).subscribe({
      next: (items) => {
        this.searchResults.set(Array.isArray(items) ? items : []);
        this.searchDropdownVisible.set((this.searchQuery().trim().length || 0) > 0);
      },
    });
  }

  /** Fallback megamenu khi chưa load được categories từ API. */
  private static readonly FALLBACK_TITLES = ['Laptop', 'PC', 'Màn hình', 'Linh Kiện', 'Gaming Gear', 'Phụ Kiện', 'Bàn - Ghế'];
  private static readonly FALLBACK_SLUGS = ['laptop', 'pc', 'man-hinh', 'linh-kien', 'gaming-gear', 'phu-kien', 'ban-ghe'];

  private buildMegamenuFromCategories(categories: Category[]): void {
    const roots = categories
      .filter((c) => c.level === 1 || c.parent_id == null || c.parent_id === '')
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .slice(0, 7);
    const byParent = new Map<string, Category[]>();
    categories.forEach((c) => {
      const pid = c.parent_id != null && c.parent_id !== '' ? String(c.parent_id) : null;
      if (pid) {
        const arr = byParent.get(pid) ?? [];
        arr.push(c);
        byParent.set(pid, arr);
      }
    });
    const icons = [
      this.megamenuIcons.laptop,
      this.megamenuIcons.laptop,
      this.megamenuIcons.gamingFurniture,
      this.megamenuIcons.pcComponents,
      this.megamenuIcons.gamingGear,
      this.megamenuIcons.shop,
      this.megamenuIcons.gamingFurniture,
    ];
    const columns: MegamenuColumn[] = roots.map((cat, i) => {
      const c = cat as Category;
      const id = c.category_id ?? c.slug ?? String(c._id ?? '');
      const children = byParent.get(id) ?? [];
      const items = children
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .slice(0, 12)
        .map((child) => {
          const ch = child as Category;
          return {
            label: ch.name,
            route: '/san-pham',
            queryParams: { category: (ch.category_id ?? ch.slug ?? String(ch._id ?? '')) },
          };
        });
      return {
        icon: icons[i] ?? this.megamenuIcons.gamingFurniture,
        title: cat.name,
        categoryId: id,
        items,
      };
    });
    this.megamenuColumns.set(columns);
  }

  private buildMegamenuFallback(): void {
    const columns: MegamenuColumn[] = HeaderComponent.FALLBACK_TITLES.map((title, i) => ({
      icon: [
        this.megamenuIcons.laptop,
        this.megamenuIcons.laptop,
        this.megamenuIcons.gamingFurniture,
        this.megamenuIcons.pcComponents,
        this.megamenuIcons.gamingGear,
        this.megamenuIcons.shop,
        this.megamenuIcons.gamingFurniture,
      ][i],
      title,
      categoryId: HeaderComponent.FALLBACK_SLUGS[i],
      items: [],
    }));
    this.megamenuColumns.set(columns);
  }

  private buildMegamenu(): void {
    this.api.getCategories().subscribe({
      next: (list) => {
        if (list?.length) {
          this.buildMegamenuFromCategories(list);
        } else {
          this.buildMegamenuFallback();
        }
      },
      error: () => this.buildMegamenuFallback(),
    });
  }

  openProductsDropdown(): void {
    if (this.closeProductsTimer) {
      clearTimeout(this.closeProductsTimer);
      this.closeProductsTimer = null;
    }
    this.productsDropdownOpen.set(true);
  }

  closeProductsDropdown(): void {
    this.closeProductsTimer = setTimeout(() => this.productsDropdownOpen.set(false), 120);
  }

  // --- User Dropdown ---
  openUserDropdown() {
    if (this.userDropdownTimer) clearTimeout(this.userDropdownTimer);
    this.userDropdownOpen.set(true);
  }
  closeUserDropdown() {
    this.userDropdownTimer = setTimeout(() => {
      this.userDropdownOpen.set(false);
    }, 200);
  }

  // --- Logout Modal ---
  showLogoutModal = signal<boolean>(false);

  openLogoutModal(): void {
    this.userDropdownOpen.set(false);
    this.showLogoutModal.set(true);
  }

  closeLogoutModal(): void {
    this.showLogoutModal.set(false);
  }

  confirmLogout(): void {
    this.auth.logout();
    this.showLogoutModal.set(false);
  }

  // --- Cart Dropdown ---
  openCartDropdown() {
    const url = this.router.url;
    if (url.includes('/cart')) return;

    if (this.cartDropdownTimer) clearTimeout(this.cartDropdownTimer);
    this.cartDropdownOpen.set(true);
  }
  closeCartDropdown() {
    this.cartDropdownTimer = setTimeout(() => {
      this.cartDropdownOpen.set(false);
    }, 200);
  }

  removeFromCart(productId?: string): void {
    if (!productId) return;
    this.cart.remove(productId);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (this.searchWrapRef?.nativeElement && !this.searchWrapRef.nativeElement.contains(e.target as Node)) {
      this.closeSearchDropdown();
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.isBrowser) return;
    const y = window.scrollY;
    this.isScrolled.set(y > 80);
    if (y <= 100) {
      this.headerVisible.set(true);
    } else if (y > this.lastScrollY + 20) {
      this.headerVisible.set(false);
    } else if (y < this.lastScrollY - 10) {
      this.headerVisible.set(true);
    }
    this.lastScrollY = y;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (!this.isBrowser) return;
    if (e.clientY <= this.HOVER_SHOW_ZONE) this.headerVisible.set(true);
  }

  setActiveMenu(menuId: string): void {
    this.activeMenu.set(menuId);
    this.menuOpen.set(false);
  }

  onNavItemHover(e: MouseEvent, itemId: string): void {
    this.navHoveredId.set(itemId);
    const li = (e.currentTarget as HTMLElement);
    const menu = this.navMenuRef?.nativeElement;
    if (!menu) return;
    const rect = li.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    this.navIndicatorLeft.set(rect.left - menuRect.left + menu.scrollLeft);
    this.navIndicatorWidth.set(rect.width);
  }

  clearNavHover(): void {
    this.navHoveredId.set(null);
  }

  toggleSearch(): void {
    this.searchOpen.update(v => !v);
    if (!this.searchOpen()) {
      this.searchQuery.set('');
      this.searchDropdownVisible.set(false);
    }
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchSubject.next(value);
  }

  submitSearch(): void {
    const q = this.searchQuery().trim();
    if (q) this.router.navigate(['/san-pham'], { queryParams: { search: q } });
    this.toggleSearch();
  }

  getProductImageUrl(p: Product): string {
    const url = productMainImage(p);
    if (!url) return 'assets/c8c67b26bfbd0df3a88be06bec886fd8bd006e7d.png';
    if (url.startsWith('http')) return url;
    const baseUrl = environment.apiUrl.replace(/\/api$/, '');
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  productPrice(p: Product): number {
    return p.salePrice ?? p.price ?? 0;
  }

  closeSearchDropdown(): void {
    this.searchDropdownVisible.set(false);
  }

  openUser(): void {
    this.menuOpen.set(false);
    if (this.auth.currentUser()) {
      this.router.navigate(['/tai-khoan']);
    } else {
      this.showLoginPopup.set(true);
    }
  }

  /** Format SĐT Việt Nam: 10 số (0xxxxxxxxx) hoặc 11 số (84xxxxxxxxx). */
  private static isValidVietnamesePhone(phone: string): boolean {
    const digits = (phone ?? '').replace(/\D/g, '');
    return (digits.length === 10 && digits.startsWith('0')) || (digits.length === 11 && digits.startsWith('84'));
  }

  /** Format SĐT để hiển thị: 84xxxxxxxxx → 0xxxxxxxxx */
  formatPhoneForDisplay(phone: string): string {
    if (!phone) return '';
    const d = phone.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('84')) return '0' + d.slice(2);
    return phone;
  }

  closeLoginPopup(): void {
    this.showLoginPopup.set(false);
    this.loginPhone.set('');
    this.loginStep.set('phone');
    this.phoneError.set(null);
    this.otpError.set(null);
    this.otpValue.set('');
    this.otpExpiresAt.set(0);
    this.loginSuccess.set(false);
    this.overlayClosing.set(false);
    this.stopCountdown();
  }

  /** Chuyển về bước nhập SĐT. */
  changePhone(): void {
    this.loginStep.set('phone');
    this.otpValue.set('');
    this.otpError.set(null);
    this.otpExpiresAt.set(0);
    this.stopCountdown();
  }

  private startCountdown(expiresAt: number): void {
    this.stopCountdown();
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      this.otpCountdownSeconds.set(left);
      if (left <= 0) this.stopCountdown();
    };
    tick();
    this.countdownInterval = setInterval(tick, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.otpCountdownSeconds.set(0);
  }

  onLoginContinue(): void {
    this.phoneError.set(null);
    const phone = this.loginPhone().trim();
    if (!phone) {
      this.phoneError.set('Thông tin bắt buộc. Vui lòng nhập đầy đủ.');
      return;
    }
    if (!HeaderComponent.isValidVietnamesePhone(phone)) {
      this.phoneError.set('Số điện thoại không hợp lệ. Vui lòng thử lại hoặc đăng nhập bằng hình thức khác.');
      return;
    }
    this.auth.requestOtp(phone).subscribe({
      next: (res) => {
        if (res.devOtp) this.toast.showOtp(res.devOtp);
        this.loginStep.set('otp');
        this.otpError.set(null);
        this.otpValue.set('');
        const expiresAt = Date.now() + 5 * 60 * 1000;
        this.otpExpiresAt.set(expiresAt);
        this.startCountdown(expiresAt);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
        this.phoneError.set(msg);
      },
    });
  }

  /** Gửi lại OTP. */
  resendOtp(): void {
    this.otpError.set(null);
    const phone = this.loginPhone().trim();
    this.auth.requestOtp(phone).subscribe({
      next: (res) => {
        if (res.devOtp) this.toast.showOtp(res.devOtp);
        const expiresAt = Date.now() + 5 * 60 * 1000;
        this.otpExpiresAt.set(expiresAt);
        this.startCountdown(expiresAt);
      },
      error: (err) => {
        this.otpError.set(err?.error?.message || 'Không gửi được mã. Vui lòng thử lại.');
      },
    });
  }

  onOtpContinue(): void {
    this.otpError.set(null);
    const otp = this.otpValue().replace(/\D/g, '');
    if (otp.length !== 6) {
      this.otpError.set('Vui lòng nhập đủ 6 chữ số.');
      return;
    }
    const phone = this.loginPhone().trim();
    this.auth.verifyOtp(phone, otp).subscribe({
      next: () => {
        this.loginSuccess.set(true);
        setTimeout(() => {
          this.overlayClosing.set(true);
          setTimeout(() => this.closeLoginPopup(), 280);
        }, 400);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Mã xác thực không chính xác. Vui lòng thử lại.';
        this.otpError.set(msg);
      },
    });
  }

  getOtpDigit(index: number): string {
    const s = this.otpValue();
    return index >= 0 && index < s.length ? s[index] : '';
  }

  /** Cập nhật OTP từ 6 ô input; tự nhảy sang ô tiếp theo khi nhập 1 số. */
  setOtpDigit(index: number, value: string): void {
    const v = value.replace(/\D/g, '').slice(0, 1);
    const cur = this.otpValue().split('');
    while (cur.length < 6) cur.push('');
    cur[index] = v;
    this.otpValue.set(cur.join(''));
    if (v && index < 5) setTimeout(() => this.focusOtpInput(index + 1), 0);
  }

  focusOtpInput(index: number): void {
    const list = this.otpInputs;
    if (list && index >= 0 && index < list.length) list.get(index)?.nativeElement.focus();
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.getOtpDigit(index) && index > 0) {
      const cur = this.otpValue().split('');
      cur[index - 1] = '';
      this.otpValue.set(cur.join(''));
      setTimeout(() => this.focusOtpInput(index - 1), 0);
    }
  }

  ngOnDestroy(): void {
    this.stopCountdown();
    this.searchSub?.unsubscribe();
    this.loginPopupSub?.unsubscribe();
    this.cartAddSub?.unsubscribe();
  }

  toggleMenu(): void { this.menuOpen.update(v => !v); }
  closeMenu(): void { this.menuOpen.set(false); }
  openCart(): void { this.menuOpen.set(false); this.router.navigate(['/cart']); }

  readonly currentUser = this.auth.currentUser;

  getAvatarUrl(path: string | undefined | null): string {
    if (!path) return 'assets/AVT/avtdefaut.png';
    if (path.startsWith('http')) return path;
    const baseUrl = environment.apiUrl.replace(/\/api$/, '');
    return `${baseUrl}${path}`;
  }
}
