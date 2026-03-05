import { Component, ChangeDetectionStrategy, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AddressService, Address, VNLocation } from '../../core/services/address.service';
import { ApiService, OrderListItem, Product } from '../../core/services/api.service';
import { CartService } from '../../core/services/cart.service';
import { environment } from '../../../environments/environment';

const ORDER_NAME_STORAGE_PREFIX = 'aurapc_order_name_';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPageComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private cart = inject(CartService);
  readonly addressService = inject(AddressService);

  readonly user = this.auth.currentUser;
  activeTab = signal<'profile' | 'orders' | 'address' | 'hub'>('profile');
  editMode = signal(false);

  // Edit form fields
  editName = '';
  editGender = '';
  editDob = '';
  editAvatar = '';

  // Orders from API
  orders = signal<OrderListItem[]>([]);
  ordersLoading = signal(false);
  orderStatusTab = signal<'all' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'return'>('all');
  orderSearch = signal('');
  selectedOrderNumber = signal<string | null>(null);
  nowTick = signal(Date.now());
  private ordersPollTimer: ReturnType<typeof setInterval> | null = null;

  // Address modal
  showAddressModal = signal(false);
  addressModalMode = signal<'add' | 'edit'>('add');
  editingAddressId = '';

  // Address form fields
  addrLabel = 'NhÃ  riÃªng';
  addrFullName = '';
  addrPhone = '';
  addrCity = '';
  addrDistrict = '';
  addrWard = '';
  addrAddress = '';
  addrIsDefault = false;

  districts = signal<VNLocation[]>([]);
  wards = signal<VNLocation[]>([]);

  // Delete modal
  showDeleteModal = signal(false);

  // Logout confirmation
  showLogoutModal = signal(false);

  // Hub social counters
  followerCount = signal(0);
  followingCount = signal(0);
  followersList = signal<any[]>([]);
  followingList = signal<any[]>([]);

  showFollowsModal = signal(false);
  followsTab = signal<'followers' | 'following'>('followers');
  hubTab = signal<'threads' | 'replies' | 'media'>('threads');
  hubThreads = signal<any[]>([]);
  hubReplies = signal<any[]>([]);
  hubMedia = signal<any[]>([]);

  hubLoading = signal(false);

  // TÃªn tÃ¹y chá»‰nh Ä‘Æ¡n hÃ ng (key = orderId), lÆ°u localStorage
  orderDisplayNames = signal<Record<string, string>>({});
  editingOrderNameId = signal<string | null>(null);
  editingOrderNameValue = '';

  constructor() {
    if (!this.auth.currentUser()) {
      this.router.navigate(['/'], { queryParams: { login: '1' } });
    } else {
      this.addressService.loadProvinces();
    }
  }

  ngOnInit(): void {
    this.loadOrderDisplayNames();
    // Äá»c tab tá»« URL ngay khi load (direct link hoáº·c refresh)
    this.syncTabFromUrl(this.route.snapshot.queryParams);
    // Theo dÃµi thay Ä‘á»•i query params (khi click link hoáº·c navigate)
    this.route.queryParams.subscribe((params) => this.syncTabFromUrl(params));
    this.loadSocialCounts(); // Load ALWAYS
  }

  ngOnDestroy(): void {
    this.stopOrdersPolling();
  }

  private syncTabFromUrl(params: Record<string, string | undefined>): void {
    const tab = params['tab'];
    if (tab === 'orders' || tab === 'address' || tab === 'profile' || tab === 'hub') {
      this.activeTab.set(tab as any);
      this.editMode.set(false);
      if (tab === 'address') this.addressService.load();
      if (tab === 'orders') {
        this.loadOrders();
        this.startOrdersPolling();
      } else {
        this.stopOrdersPolling();
      }
      if (tab === 'hub') {
        this.loadSocialCounts();
        // luÃ´n load Threads láº§n Ä‘áº§u khi vÃ o tab Hoáº¡t Ä‘á»™ng AuraHub
        this.setHubTab(this.hubTab());
      }
    }
  }

  private startOrdersPolling(): void {
    if (this.ordersPollTimer) return;
    this.ordersPollTimer = setInterval(() => {
      this.nowTick.set(Date.now());
      if (this.activeTab() === 'orders') this.loadOrders(true);
    }, 15000);
  }

  private stopOrdersPolling(): void {
    if (!this.ordersPollTimer) return;
    clearInterval(this.ordersPollTimer);
    this.ordersPollTimer = null;
  }

  displayName = computed(() => {
    const u = this.user();
    if (!u) return '';
    const name = u.profile?.fullName?.trim();
    return name || this.formatPhone(u.phoneNumber);
  });

  displayPhone = computed(() => {
    const u = this.user();
    return u ? this.formatPhone(u.phoneNumber) : '';
  });

  displayGender = computed(() => {
    const u = this.user();
    const g = u?.profile?.gender?.trim();
    if (!g) return null;
    const map: Record<string, string> = { male: 'Nam', female: 'Ná»¯', other: 'KhÃ¡c' };
    return map[g.toLowerCase()] || g;
  });

  displayDob = computed(() => {
    const u = this.user();
    const d = u?.profile?.dateOfBirth;
    if (!d) return null;
    const date = typeof d === 'string' ? new Date(d) : d;
    return isNaN(date.getTime()) ? null : date;
  });

  formatPhone(phone: string): string {
    if (!phone) return '';
    const d = phone.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('84')) return '0' + d.slice(2);
    return phone;
  }

  formatDate(d: Date): string {
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN') + 'â‚«';
  }

  switchTab(tab: 'profile' | 'orders' | 'address' | 'hub') {
    this.activeTab.set(tab);
    this.editMode.set(false);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
    if (tab === 'address') {
      this.addressService.load();
    }
    if (tab === 'orders') {
      this.loadOrders();
      this.startOrdersPolling();
    } else {
      this.stopOrdersPolling();
    }
    if (tab === 'hub') {
      this.setHubTab(this.hubTab());
    }
  }

  private loadSocialCounts(): void {
    const u = this.user();
    const userId = u?._id ?? (u as any)?.id;
    if (!userId) return;
    this.api.getFollowers(userId).subscribe({
      next: (res) => {
        this.followerCount.set(res.followerCount ?? (res.followers?.length ?? 0));
        this.followersList.set(res.followers || []);
      },
      error: () => { },
    });
    this.api.getFollowing(userId).subscribe({
      next: (res) => {
        this.followingCount.set(res.followingCount ?? (res.following?.length ?? 0));
        this.followingList.set(res.following || []);
      },
      error: () => { },
    });
  }

  // Modals for followers/following
  openFollowsModal(tab: 'followers' | 'following'): void {
    this.followsTab.set(tab);
    this.showFollowsModal.set(true);
  }

  closeFollowsModal(): void {
    this.showFollowsModal.set(false);
  }

  getUserDisplayName(u: any): string {
    return u?.profile?.fullName || u?.username || u?.phoneNumber || 'NgÆ°á»i dÃ¹ng';
  }

  getUserAvatarUrl(u: any): string {
    if (u?.avatar) {
      if (u.avatar.startsWith('http')) return u.avatar;
      return `${environment.apiUrl.replace('/api', '')}${u.avatar.startsWith('/') ? '' : '/'}${u.avatar}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.getUserDisplayName(u))}&background=random`;
  }

  isCurrentUserFollowing(targetUserId: string): boolean {
    return this.followingList().some(u => u._id === targetUserId);
  }

  toggleFollowUser(targetUser: any): void {
    const targetUserId = targetUser._id;
    if (!targetUserId) return;
    this.api.toggleFollow(targetUserId).subscribe({
      next: (res) => {
        this.followingCount.set(res.followingCount);
        // Cáº§n reload láº¡i danh sÃ¡ch Ä‘á»ƒ modal update chÃ­nh xÃ¡c
        this.loadSocialCounts();
      },
      error: (err) => {
        const msg = err?.error?.message || 'KhÃ´ng thá»ƒ thá»±c hiá»‡n Follow';
        alert(msg);
      }
    });
  }

  // Hoáº¡t Ä‘á»™ng AuraHub
  setHubTab(tab: 'threads' | 'replies' | 'media'): void {
    this.hubTab.set(tab);
    this.loadHubActivity(tab);
  }

  private loadHubActivity(tab: 'threads' | 'replies' | 'media'): void {
    const u = this.user();
    const userId = u?._id ?? (u as any)?.id;
    if (!userId) return;
    this.hubLoading.set(true);
    if (tab === 'replies') {
      this.api.getHubUserReplies(userId).subscribe({
        next: (res) => {
          this.hubReplies.set(res.items || []);
          this.hubLoading.set(false);
        },
        error: () => this.hubLoading.set(false),
      });
      return;
    }
    const typeMap: Record<'threads' | 'media', 'threads' | 'media'> = {
      threads: 'threads',
      media: 'media',
    };
    this.api.getHubUserPosts(userId, typeMap[tab]).subscribe({
      next: (res) => {
        const items = res.items || [];
        if (tab === 'threads') this.hubThreads.set(items);
        if (tab === 'media') this.hubMedia.set(items);

        this.hubLoading.set(false);
      },
      error: () => this.hubLoading.set(false),
    });
  }

  loadOrders(silent = false): void {
    const user = this.user();
    const userId = user?._id ?? (user as { id?: string })?.id;
    if (!userId) return;
    if (!silent) this.ordersLoading.set(true);
    this.api.getOrdersByUser(userId).subscribe({
      next: (list) => {
        this.orders.set(list);
        if (!silent) this.ordersLoading.set(false);
      },
      error: () => {
        this.orders.set([]);
        if (!silent) this.ordersLoading.set(false);
      },
    });
  }

  /** Status tab filter: all | processing (pending,confirmed,processing) | shipped | delivered | cancelled | return */
  readonly orderStatusFilter = (order: OrderListItem): boolean => {
    const tab = this.orderStatusTab();
    if (tab === 'all') return true;
    if (tab === 'return') return this.hasReturnRequest(order);
    if (tab === 'processing') return ['pending', 'confirmed', 'processing'].includes(order.status);
    return order.status === tab;
  };

  readonly filteredOrders = computed(() => {
    const list = this.orders();
    const q = this.orderSearch().trim().toLowerCase();
    let filtered = list.filter((o) => this.orderStatusFilter(o));
    if (q) {
      filtered = filtered.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          (o.items?.some((i) => (i.name || '').toLowerCase().includes(q)) ?? false)
      );
    }
    return filtered;
  });

  hasReturnRequest(order: OrderListItem): boolean {
    const s = order.returnRequest?.status;
    return !!s && s !== 'none';
  }

  hasPendingCancelRequest(order: OrderListItem): boolean {
    return order.cancelRequest?.status === 'pending';
  }

  hasPendingReturnRequest(order: OrderListItem): boolean {
    return order.returnRequest?.status === 'pending';
  }

  isShippingActionReady(order: OrderListItem): boolean {
    if (order.status !== 'shipped') return false;
    const baseTime = order.shippedAt || order.updatedAt || order.createdAt;
    if (!baseTime) return false;
    const shippedAtMs = new Date(baseTime).getTime();
    if (isNaN(shippedAtMs)) return false;
    return this.nowTick() - shippedAtMs >= 30 * 60 * 1000;
  }

  canCancelOrder(order: OrderListItem): boolean {
    if (!['pending', 'confirmed', 'processing'].includes(order.status)) return false;
    return !this.hasPendingCancelRequest(order);
  }

  canShowDeliveryActions(order: OrderListItem): boolean {
    if (order.status !== 'shipped') return false;
    if (!this.isShippingActionReady(order)) return false;
    return !this.hasPendingReturnRequest(order);
  }

  minutesUntilShippingAction(order: OrderListItem): number {
    if (order.status !== 'shipped') return 0;
    const baseTime = order.shippedAt || order.updatedAt || order.createdAt;
    if (!baseTime) return 0;
    const shippedAtMs = new Date(baseTime).getTime();
    if (isNaN(shippedAtMs)) return 0;
    const remainMs = 30 * 60 * 1000 - (this.nowTick() - shippedAtMs);
    if (remainMs <= 0) return 0;
    return Math.ceil(remainMs / 60_000);
  }

  setOrderStatusTab(tab: 'all' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'return'): void {
    this.orderStatusTab.set(tab);
  }

  orderStatusLabel(order: OrderListItem): string {
    if (order.cancelRequest?.status === 'pending') return 'YÃƒÂªu cÃ¡ÂºÂ§u hÃ¡Â»Â§y';
    if (order.returnRequest?.status === 'pending') return 'YÃƒÂªu cÃ¡ÂºÂ§u hoÃƒÂ n trÃ¡ÂºÂ£';
    if (order.returnRequest?.status === 'approved') return 'Ã„ÂÃƒÂ£ duyÃ¡Â»â€¡t hoÃƒÂ n trÃ¡ÂºÂ£';
    if (order.returnRequest?.status === 'rejected') return 'TÃ¡Â»Â« chÃ¡Â»â€˜i hoÃƒÂ n trÃ¡ÂºÂ£';

    const map: Record<string, string> = {
      pending: 'Äang xá»­ lÃ½',
      confirmed: 'Äang xá»­ lÃ½',
      processing: 'Äang xá»­ lÃ½',
      shipped: 'Äang váº­n chuyá»ƒn',
      delivered: 'ÄÃ£ giao',
      cancelled: 'ÄÃ£ há»§y',
    };
    return map[order.status] ?? order.status;
  }

  orderStatusClass(order: OrderListItem): string {
    if (order.returnRequest?.status === 'approved') return 'status--cancelled';
    if (order.cancelRequest?.status === 'pending' || order.returnRequest?.status === 'pending') return 'status--pending';
    if (order.status === 'delivered') return 'status--delivered';
    if (order.status === 'shipped') return 'status--shipping';
    if (order.status === 'cancelled') return 'status--cancelled';
    return 'status--pending';
  }

  formatOrderDate(createdAt: string | undefined): string {
    if (!createdAt) return 'â€”';
    const d = new Date(createdAt);
    return isNaN(d.getTime()) ? 'â€”' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  orderItemCount(order: OrderListItem): number {
    return order.items?.reduce((sum, i) => sum + (i.qty || 1), 0) ?? 0;
  }

  openOrderDetail(orderNumber: string): void {
    this.selectedOrderNumber.set(orderNumber);
  }

  cancelOrder(order: OrderListItem): void {
    if (!this.canCancelOrder(order)) return;
    if (!confirm('Báº¡n cÃ³ cháº¯c muá»‘n gá»­i yÃªu cáº§u há»§y Ä‘Æ¡n #ORD-' + order.orderNumber + '?')) return;
    const reason = prompt('LÃ½ do há»§y Ä‘Æ¡n (khÃ´ng báº¯t buá»™c):', '') || '';
    this.api.requestOrderCancellation(order.orderNumber, reason).subscribe({
      next: () => {
        alert('ÄÃ£ gá»­i yÃªu cáº§u há»§y Ä‘Æ¡n. Vui lÃ²ng chá» admin xá»­ lÃ½.');
        this.loadOrders();
      },
      error: (err) => {
        alert(err?.error?.error || 'KhÃ´ng thá»ƒ gá»­i yÃªu cáº§u há»§y Ä‘Æ¡n');
      },
    });
  }

  confirmOrderReceived(order: OrderListItem): void {
    if (!this.canShowDeliveryActions(order)) return;
    if (!confirm('XÃ¡c nháº­n báº¡n Ä‘Ã£ nháº­n Ä‘Æ°á»£c hÃ ng cho Ä‘Æ¡n #ORD-' + order.orderNumber + '?')) return;
    this.api.confirmOrderReceived(order.orderNumber).subscribe({
      next: () => {
        alert('Cáº£m Æ¡n báº¡n! ÄÆ¡n hÃ ng Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c nháº­n Ä‘Ã£ giao.');
        this.loadOrders();
      },
      error: (err) => {
        alert(err?.error?.error || 'KhÃ´ng thá»ƒ xÃ¡c nháº­n nháº­n hÃ ng');
      },
    });
  }

  requestOrderReturn(order: OrderListItem): void {
    if (!this.canShowDeliveryActions(order)) return;
    const reason = prompt('Nháº­p lÃ½ do hoÃ n tráº£ (khÃ´ng báº¯t buá»™c):', '') || '';
    if (!confirm('Gá»­i yÃªu cáº§u hoÃ n tráº£ cho Ä‘Æ¡n #ORD-' + order.orderNumber + '?')) return;
    this.api.requestOrderReturn(order.orderNumber, reason).subscribe({
      next: () => {
        alert('ÄÃ£ gá»­i yÃªu cáº§u hoÃ n tráº£. Vui lÃ²ng chá» admin xá»­ lÃ½.');
        this.loadOrders();
      },
      error: (err) => {
        alert(err?.error?.error || 'KhÃ´ng thá»ƒ gá»­i yÃªu cáº§u hoÃ n tráº£');
      },
    });
  }

  repurchaseOrder(order: OrderListItem): void {
    const items = order.items ?? [];
    for (const item of items) {
      const product = item?.product;
      const qty = Math.max(1, Number(item?.qty) || 1);
      if (product && typeof product === 'object' && ('_id' in product || 'id' in product)) {
        this.cart.add(product as Product, qty);
      }
    }
    this.router.navigate(['/cart']);
  }

  closeOrderDetail(): void {
    this.selectedOrderNumber.set(null);
  }

  readonly selectedOrderDetail = computed(() => {
    const num = this.selectedOrderNumber();
    if (!num) return null;
    return this.orders().find((o) => o.orderNumber === num) ?? null;
  });

  /** TÃªn Ä‘Æ¡n hÃ ng máº·c Ä‘á»‹nh: "ÄÆ¡n hÃ ng ngÃ y DD/MM/YYYY" */
  getOrderDisplayNameDefault(createdAt: string | undefined): string {
    const d = this.formatOrderDate(createdAt);
    return d === 'â€”' ? 'ÄÆ¡n hÃ ng' : `ÄÆ¡n hÃ ng ngÃ y ${d}`;
  }

  getOrderDisplayName(orderId: string, createdAt: string | undefined): string {
    const custom = this.orderDisplayNames()[orderId];
    if (custom?.trim()) return custom.trim();
    return this.getOrderDisplayNameDefault(createdAt);
  }

  loadOrderDisplayNames(): void {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ORDER_NAME_STORAGE_PREFIX + 'all') : null;
      const obj = raw ? JSON.parse(raw) as Record<string, string> : {};
      this.orderDisplayNames.set(obj);
    } catch {
      this.orderDisplayNames.set({});
    }
  }

  private saveOrderDisplayNames(names: Record<string, string>): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ORDER_NAME_STORAGE_PREFIX + 'all', JSON.stringify(names));
    } catch { }
    this.orderDisplayNames.set({ ...names });
  }

  startEditOrderName(detail: OrderListItem): void {
    this.editingOrderNameId.set(detail._id);
    this.editingOrderNameValue = this.getOrderDisplayName(detail._id, detail.createdAt);
  }

  saveOrderName(orderId: string): void {
    const val = this.editingOrderNameValue?.trim();
    const names = { ...this.orderDisplayNames() };
    if (val) names[orderId] = val;
    else delete names[orderId];
    this.saveOrderDisplayNames(names);
    this.editingOrderNameId.set(null);
  }

  cancelEditOrderName(): void {
    this.editingOrderNameId.set(null);
  }

  /** áº¢nh sáº£n pháº©m trong Ä‘Æ¡n (item.product.images), tráº£ vá» URL Ä‘áº§y Ä‘á»§ náº¿u lÃ  path */
  orderItemImage(item: OrderListItem['items'][0]): string {
    const p = item.product as { images?: unknown[] } | undefined;
    if (!p?.images?.length) return '';
    const first = p.images[0];
    const url = typeof first === 'string' ? first : (first as { url?: string })?.url ?? '';
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return base + (url.startsWith('/') ? url : '/' + url);
  }

  startEdit() {
    const u = this.user();
    this.editName = u?.profile?.fullName || '';
    this.editGender = u?.profile?.gender || '';
    this.editDob = u?.profile?.dateOfBirth || '';
    this.editAvatar = u?.avatar || '';
    this.editMode.set(true);
  }

  cancelEdit() {
    this.editMode.set(false);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.auth.uploadAvatar(file).subscribe({
        next: (res) => {
          if (res.success) {
            // Success - updated automatically in signal
          }
        },
        error: (err) => alert('Lá»—i upload áº£nh: ' + (err.message || 'KhÃ´ng xÃ¡c Ä‘á»‹nh'))
      });
    }
  }

  saveProfile() {
    this.auth.updateProfile({
      fullName: this.editName,
      gender: this.editGender,
      dateOfBirth: this.editDob
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.editMode.set(false);
        }
      },
      error: (err) => alert('Lá»—i cáº­p nháº­t: ' + (err.message || 'KhÃ´ng xÃ¡c Ä‘á»‹nh'))
    });
  }

  openLogoutConfirm(): void {
    this.showLogoutModal.set(true);
  }

  closeLogoutConfirm(): void {
    this.showLogoutModal.set(false);
  }

  confirmLogout(): void {
    this.showLogoutModal.set(false);
    this.auth.logout();
    this.router.navigate(['/']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  getStatusClass(status: string): string {
    if (status === 'ÄÃ£ giao') return 'status--delivered';
    if (status === 'Äang váº­n chuyá»ƒn') return 'status--shipping';
    if (status === 'ÄÃ£ há»§y') return 'status--cancelled';
    return 'status--pending';
  }

  getAvatarUrl(path: string | undefined | null): string {
    if (!path) return 'assets/AVT/avtdefaut.png';
    if (path.startsWith('http')) return path;
    const baseUrl = environment.apiUrl.replace(/\/api$/, '');
    return `${baseUrl}${path} `;
  }

  // ========== Address Management ==========

  openAddAddress() {
    this.addressModalMode.set('add');
    this.editingAddressId = '';
    this.addrLabel = 'NhÃ  riÃªng';
    this.addrFullName = '';
    this.addrPhone = '';
    this.addrCity = '';
    this.addrDistrict = '';
    this.addrWard = '';
    this.addrAddress = '';
    this.addrIsDefault = false;
    this.districts.set([]);
    this.wards.set([]);
    this.showAddressModal.set(true);
  }

  openEditAddress(addr: Address) {
    this.addressModalMode.set('edit');
    this.editingAddressId = addr._id;
    this.addrLabel = addr.label;
    this.addrFullName = addr.fullName;
    this.addrPhone = addr.phone;
    this.addrCity = addr.city;
    this.addrDistrict = addr.district;
    this.addrWard = addr.ward;
    this.addrAddress = addr.address;
    this.addrIsDefault = addr.isDefault;
    this.districts.set([]);
    this.wards.set([]);
    this.showAddressModal.set(true);

    // Load dependent locations if city is already filled
    if (addr.city) {
      this.loadDependentLocations(addr.city, addr.district);
    }
  }

  onProvinceChange() {
    const p = this.addressService.provinces().find(x => x.name === this.addrCity);
    this.districts.set([]);
    this.wards.set([]);
    this.addrDistrict = '';
    this.addrWard = '';
    if (p) {
      this.addressService.getDistricts(p.code).subscribe(res => {
        this.districts.set(res.districts || []);
      });
    }
  }

  onDistrictChange() {
    const d = this.districts().find(x => x.name === this.addrDistrict);
    this.wards.set([]);
    this.addrWard = '';
    if (d) {
      this.addressService.getWards(d.code).subscribe(res => {
        this.wards.set(res.wards || []);
      });
    }
  }

  private loadDependentLocations(city: string, district?: string) {
    // wait for provinces to load if they haven't yet
    const checkProvinces = setInterval(() => {
      const provs = this.addressService.provinces();
      if (provs.length > 0) {
        clearInterval(checkProvinces);
        const p = provs.find(x => x.name === city);
        if (p) {
          this.addressService.getDistricts(p.code).subscribe(res => {
            this.districts.set(res.districts || []);
            if (district) {
              const d = (res.districts || []).find((x: any) => x.name === district);
              if (d) {
                this.addressService.getWards(d.code).subscribe(wRes => {
                  this.wards.set(wRes.wards || []);
                });
              }
            }
          });
        }
      }
    }, 100);
  }

  closeAddressModal() {
    this.showAddressModal.set(false);
  }

  saveAddress() {
    if (!this.addrFullName.trim() || !this.addrPhone.trim()) {
      alert('Vui lÃ²ng nháº­p há» tÃªn vÃ  sá»‘ Ä‘iá»‡n thoáº¡i.');
      return;
    }

    const data = {
      label: this.addrLabel,
      fullName: this.addrFullName,
      phone: this.addrPhone,
      city: this.addrCity,
      district: this.addrDistrict,
      ward: this.addrWard,
      address: this.addrAddress,
      isDefault: this.addrIsDefault,
    };

    if (this.addressModalMode() === 'add') {
      this.addressService.add(data as any);
    } else {
      this.addressService.update(this.editingAddressId, data);
    }
    this.showAddressModal.set(false);
  }

  deleteAddress(addressId: string) {
    this.editingAddressId = addressId;
    this.showDeleteModal.set(true);
  }

  confirmDeleteAddress() {
    const addressId = this.editingAddressId;
    if (addressId) {
      const card = document.getElementById('addr-card-' + addressId);
      if (card) {
        card.classList.add('is-deleting');
        setTimeout(() => {
          this.addressService.remove(addressId);
          this.showDeleteModal.set(false);
          this.closeAddressModal();
        }, 300);
      } else {
        this.addressService.remove(addressId);
        this.showDeleteModal.set(false);
        this.closeAddressModal();
      }
    }
  }

  cancelDeleteAddress() {
    this.showDeleteModal.set(false);
  }

  setDefaultAddress(addressId: string) {
    this.addressService.setDefault(addressId);
  }

  // â”€â”€â”€ AuraHub Activity Helpers â”€â”€â”€
  timeAgo(date: string): string {
    const now = Date.now();
    const d = new Date(date).getTime();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(date).toLocaleDateString('vi-VN');
  }

  getHubImageUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = environment.apiUrl.replace(/\/api$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  openHubPost(postId: string): void {
    this.router.navigate(['/aura-hub', postId]);
  }

  getHubDisplayName(user: any): string {
    if (!user) return 'áº¨n danh';
    if (user.profile?.fullName) return user.profile.fullName;
    if (user.username) return user.username;
    if (user.phoneNumber) {
      const d = user.phoneNumber.replace(/\D/g, '');
      if (d.length === 11 && d.startsWith('84')) return '0' + d.slice(2);
      return user.phoneNumber;
    }
    return 'áº¨n danh';
  }

  getHubAvatarUrl(user: any): string {
    if (!user?.avatar) return 'assets/AVT/avtdefaut.png';
    if (user.avatar.startsWith('http')) return user.avatar;
    const base = environment.apiUrl.replace(/\/api$/, '');
    return `${base}${user.avatar}`;
  }
}

