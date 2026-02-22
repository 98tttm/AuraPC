import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { ApiService, productDisplayPrice, productMainImage, Product } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { Location } from '@angular/common';
import { AddressService, Address, VNLocation } from '../../core/services/address.service';
import { CheckoutStepperComponent } from '../../components/checkout-stepper/checkout-stepper.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CheckoutStepperComponent],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
})
export class CheckoutComponent implements OnInit, OnDestroy {
  @ViewChildren('codOtpInput') codOtpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private cart = inject(CartService);
  private api = inject(ApiService);
  private router = inject(Router);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  readonly addressService = inject(AddressService);

  // Auth state
  isLoggedIn = computed(() => !!this.auth.currentUser());

  // Form fields
  fullName = '';
  phone = '';
  email = '';
  receiverName = '';
  receiverPhone = '';
  address = '';
  city = '';
  district = '';
  ward = '';
  note = '';
  couponCode = '';
  paymentMethod = 'cod';
  requestInvoice = false;
  invoiceEmail = '';
  invoiceType = 'personal'; // 'personal' or 'company'

  // Selected saved address ID
  selectedAddressId = '';

  // Address Modal State
  showAddressModal = signal(false);
  addressModalMode = signal<'select' | 'add'>('select');
  tempSelectedAddressId = '';
  modalError = signal<string | null>(null);

  // Address Form Fields inside Modal
  addrLabel = 'Nhà riêng';
  addrFullName = '';
  addrPhone = '';
  addrCity = '';
  addrDistrict = '';
  addrWard = '';
  addrAddress = '';
  addrIsDefault = false;

  districts = signal<VNLocation[]>([]);
  wards = signal<VNLocation[]>([]);

  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  /** COD: popup xác nhận OTP */
  showCodOtpPopup = signal(false);
  codOtpPhone = '';
  codOtpValue = signal('');
  codOtpError = signal<string | null>(null);
  codOtpExpiresAt = signal(0);
  codOtpCountdownSeconds = signal(0);
  private codCountdownInterval: ReturnType<typeof setInterval> | null = null;


  // Cart data
  cartItems = computed(() => this.cart.getItems());
  cartTotal = this.cart.cartTotal;

  /** Original total (using old_price where a sale exists) */
  originalTotal = computed(() => {
    return this.cartItems().reduce((total, item) => {
      const p = item.product;
      const oldPrice = p?.old_price ?? 0;
      const displayPrice = productDisplayPrice(p);
      const price = (oldPrice > 0 && oldPrice > displayPrice) ? oldPrice : displayPrice;
      return total + (price * item.qty);
    }, 0);
  });

  /** Direct discount = sum of (old_price - display_price) * qty */
  directDiscount = computed(() => {
    return this.cartItems().reduce((total, item) => {
      const p = item.product;
      const displayPrice = productDisplayPrice(p);
      const oldPrice = p?.old_price ?? 0;
      if (oldPrice > 0 && displayPrice < oldPrice) {
        return total + ((oldPrice - displayPrice) * item.qty);
      }
      return total;
    }, 0);
  });

  /** Selected total (after sale discounts) */
  selectedTotal = computed(() => {
    return this.cartItems().reduce((total, item) => {
      return total + (productDisplayPrice(item.product) * item.qty);
    }, 0);
  });

  ngOnInit(): void {
    const savedMethod = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('aurapc_checkout_payment_method') : null;
    if (savedMethod && ['cod', 'qr', 'momo', 'zalopay', 'atm'].includes(savedMethod)) {
      this.paymentMethod = savedMethod;
    }
    const user = this.auth.currentUser();
    if (user) {
      // Auto-fill buyer info from profile
      this.fullName = user.profile?.fullName || '';
      this.phone = this.formatPhoneDisplay(user.phoneNumber);
      this.email = user.email || '';

      // Load saved addresses
      this.addressService.load();

      // Wait a tick for addresses to load, then select default
      setTimeout(() => {
        const defaultAddr = this.addressService.getDefault();
        if (defaultAddr) {
          this.applyAddress(defaultAddr);
          this.selectedAddressId = defaultAddr._id;
        }
      }, 500);
    }
  }

  private formatPhoneDisplay(phone: string): string {
    if (!phone) return '';
    const d = phone.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('84')) return '0' + d.slice(2);
    return phone;
  }

  /** Apply a saved address to the form */
  applyAddress(addr: Address) {
    this.receiverName = addr.fullName;
    this.receiverPhone = addr.phone;
    this.address = addr.address;
    this.city = addr.city;
    this.district = addr.district;
    this.ward = addr.ward;
  }

  onAddressSelect() {
    const addr = this.addressService.addresses().find(a => a._id === this.selectedAddressId);
    if (addr) {
      this.applyAddress(addr);
    } else {
      this.receiverName = '';
      this.receiverPhone = '';
      this.address = '';
      this.city = '';
      this.district = '';
      this.ward = '';
    }
  }

  // ========== Modal Address Handlers ==========
  openAddressModal() {
    this.tempSelectedAddressId = this.selectedAddressId;
    this.addressModalMode.set('select');
    this.modalError.set(null);
    this.showAddressModal.set(true);
  }

  closeAddressModal() {
    this.showAddressModal.set(false);
  }

  isAddressDefault(id: string): boolean {
    const addr = this.addressService.addresses().find(a => a._id === id);
    return !!addr?.isDefault;
  }

  switchToSelectMode() {
    this.modalError.set(null);
    this.addressModalMode.set('select');
  }

  switchToAddMode() {
    this.modalError.set(null);
    this.addrLabel = 'Nhà riêng';
    this.addrFullName = this.fullName; // prefill from user profile
    this.addrPhone = this.phone;
    this.addrCity = '';
    this.addrDistrict = '';
    this.addrWard = '';
    this.addrAddress = '';
    this.addrIsDefault = this.addressService.addresses().length === 0;
    this.districts.set([]);
    this.wards.set([]);
    this.addressModalMode.set('add');
  }

  confirmTempAddress() {
    if (!this.tempSelectedAddressId) {
      this.modalError.set('Vui lòng chọn một địa chỉ.');
      return;
    }
    this.modalError.set(null);
    this.selectedAddressId = this.tempSelectedAddressId;
    this.onAddressSelect();
    this.closeAddressModal();
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

  saveNewAddress() {
    if (!this.addrFullName.trim() || !this.addrPhone.trim() || !this.addrCity || !this.addrDistrict || !this.addrWard || !this.addrAddress.trim()) {
      this.modalError.set('Vui lòng điền đầy đủ thông tin địa chỉ (*).');
      return;
    }

    const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
    if (!phoneRegex.test(this.addrPhone.replace(/\D/g, ''))) {
      this.modalError.set('Số điện thoại không hợp lệ. Vui lòng nhập đúng số điện thoại di động Việt Nam.');
      return;
    }

    this.modalError.set(null);

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

    // The add() method internally updates addressService.addresses signal
    this.addressService.add(data as any);

    // Automatically switch back to selection mode
    // Note: To automatically SELECT the newly added address, we'd need its ID. 
    // Since add() doesn't return the ID synchronously (it's void and makes an HTTP call), 
    // we'll just slide back to 'select' and let the user click it.
    this.switchToSelectMode();
  }

  getImage(p: Product) { return productMainImage(p); }
  getPrice(p: Product) { return productDisplayPrice(p); }

  priceLabel(p: Product): string {
    const price = productDisplayPrice(p);
    if (!price || price <= 0) return 'Liên hệ';
    return price.toLocaleString('vi-VN') + '₫';
  }

  formatPrice(n: number): string {
    if (!n || n <= 0) return '0₫';
    return n.toLocaleString('vi-VN') + '₫';
  }

  directDiscountLabel(): string {
    const d = this.directDiscount();
    if (!d || d <= 0) return '0₫';
    return '-' + d.toLocaleString('vi-VN') + '₫';
  }

  removeItem(productId: string) {
    this.cart.remove(productId);
    if (this.cartItems().length === 0) {
      this.router.navigate(['/cart']);
    }
  }

  submitOrder() {
    this.errorMessage.set(null);

    // Guest Info check
    if (!this.fullName.trim() || !this.phone.trim()) {
      this.errorMessage.set('Vui lòng điền họ tên và số điện thoại người đặt.');
      return;
    }

    const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
    if (!phoneRegex.test(this.phone.replace(/\D/g, ''))) {
      this.errorMessage.set('Số điện thoại người đặt không hợp lệ. Vui lòng nhập đúng SĐT Việt Nam.');
      return;
    }

    // Default address or explicit address check
    if (!this.isLoggedIn() || (this.isLoggedIn() && this.addressService.addresses().length === 0)) {
      if (!this.address.trim()) {
        this.errorMessage.set('Vui lòng nhập địa chỉ nhận hàng.');
        return;
      }
      if (this.receiverPhone) {
        if (!phoneRegex.test(this.receiverPhone.replace(/\D/g, ''))) {
          this.errorMessage.set('Số điện thoại người nhận không hợp lệ.');
          return;
        }
      }
    } else {
      if (!this.selectedAddressId) {
        this.errorMessage.set('Vui lòng chọn hoặc thêm một địa chỉ nhận hàng.');
        return;
      }
    }

    if (this.requestInvoice) {
      if (!this.invoiceEmail.trim()) {
        this.errorMessage.set('Vui lòng nhập Email để nhận hóa đơn điện tử.');
        return;
      }
    }

    const items = this.cartItems().map(i => ({
      product: i.product._id!,
      name: i.product.name,
      price: productDisplayPrice(i.product),
      qty: i.qty,
    }));

    if (!items.length) {
      this.errorMessage.set('Giỏ hàng trống.');
      return;
    }

    // QR / MoMo / ZaloPay / ATM: không tạo đơn ngay — lưu payload + summary, chuyển sang trang thanh toán tương ứng.
    if (this.paymentMethod === 'qr' || this.paymentMethod === 'momo' || this.paymentMethod === 'zalopay' || this.paymentMethod === 'atm') {
      const payload = this.buildOrderPayload();
      const summary = {
        originalTotal: this.originalTotal(),
        directDiscount: this.directDiscount(),
        amount: this.selectedTotal(),
      };
      const storageKey = this.paymentMethod === 'qr' ? 'aurapc_qr_pending'
        : this.paymentMethod === 'momo' ? 'aurapc_momo_pending'
        : this.paymentMethod === 'zalopay' ? 'aurapc_zalopay_pending'
        : 'aurapc_atm_pending';
      const route = this.paymentMethod === 'qr' ? '/checkout-qr-payment'
        : this.paymentMethod === 'momo' ? '/checkout-momo-payment'
        : this.paymentMethod === 'zalopay' ? '/checkout-zalopay-payment'
        : '/checkout-atm-payment';
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ ...payload, ...summary }));
        sessionStorage.setItem('aurapc_checkout_payment_method', this.paymentMethod);
      } catch (e) {
        this.errorMessage.set('Không thể lưu thông tin. Vui lòng thử lại.');
        return;
      }
      this.router.navigate([route], { queryParams: { amount: this.selectedTotal() } });
      return;
    }

    // COD: gửi OTP, hiện toast mã OTP, mở popup nhập OTP; xác thực xong mới tạo đơn.
    if (this.paymentMethod === 'cod') {
      const phone = (this.receiverPhone || this.phone).trim();
      if (!phone) {
        this.errorMessage.set('Vui lòng nhập số điện thoại người nhận hoặc người đặt.');
        return;
      }
      this.submitting.set(true);
      this.auth.requestOtp(phone).subscribe({
        next: (res) => {
          this.submitting.set(false);
          if (res.devOtp) this.toast.showOtp(res.devOtp);
          this.codOtpPhone = phone;
          this.codOtpValue.set('');
          this.codOtpError.set(null);
          const expiresAt = Date.now() + 5 * 60 * 1000;
          this.codOtpExpiresAt.set(expiresAt);
          this.startCodCountdown(expiresAt);
          this.showCodOtpPopup.set(true);
          setTimeout(() => this.focusCodOtpInput(0), 100);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.error?.message || 'Không gửi được mã OTP. Vui lòng thử lại.');
        },
      });
      return;
    }

    this.doCreateOrder();
  }

  /** Build payload cho createOrder (dùng cho QR pending và doCreateOrder). */
  private buildOrderPayload(): { items: { product: string; name: string; price: number; qty: number }[]; shippingAddress: Record<string, string> } {
    const items = this.cartItems().map(i => ({
      product: i.product._id!,
      name: i.product.name,
      price: productDisplayPrice(i.product),
      qty: i.qty,
    }));
    const shippingAddress = {
      fullName: this.receiverName || this.fullName,
      phone: this.receiverPhone || this.phone,
      email: this.requestInvoice ? this.invoiceEmail : this.email,
      address: this.address,
      city: this.city,
      district: this.district,
      ward: this.ward,
      note: this.requestInvoice ? '[Yêu cầu HĐĐT - ' + (this.invoiceType === 'company' ? 'Công ty' : 'Cá nhân') + '] ' + this.note : this.note,
    };
    return { items, shippingAddress };
  }

  /** Tạo đơn hàng (gọi trực tiếp khi không COD, hoặc sau khi xác thực OTP COD). */
  doCreateOrder(): void {
    const { items, shippingAddress } = this.buildOrderPayload();
    this.submitting.set(true);
    this.api.createOrder({
      items,
      shippingAddress,
    }).subscribe({
      next: (res) => {
        this.cart.clear();
        try { sessionStorage.removeItem('aurapc_checkout_payment_method'); } catch {}
        this.router.navigate(['/checkout-success'], { queryParams: { order: res.orderNumber } });
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
      },
    });
  }

  ngOnDestroy(): void {
    this.stopCodCountdown();
  }

  closeCodOtpPopup(): void {
    this.showCodOtpPopup.set(false);
    this.codOtpValue.set('');
    this.codOtpError.set(null);
    this.stopCodCountdown();
  }

  codCountdownText(): string {
    const s = this.codOtpCountdownSeconds();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  private startCodCountdown(expiresAt: number): void {
    this.stopCodCountdown();
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      this.codOtpCountdownSeconds.set(left);
      if (left <= 0) this.stopCodCountdown();
    };
    tick();
    this.codCountdownInterval = setInterval(tick, 1000);
  }

  private stopCodCountdown(): void {
    if (this.codCountdownInterval) {
      clearInterval(this.codCountdownInterval);
      this.codCountdownInterval = null;
    }
    this.codOtpCountdownSeconds.set(0);
  }

  getCodOtpDigit(index: number): string {
    const s = this.codOtpValue();
    return index >= 0 && index < s.length ? s[index] : '';
  }

  setCodOtpDigit(index: number, value: string): void {
    const v = value.replace(/\D/g, '').slice(0, 1);
    const cur = this.codOtpValue().split('');
    while (cur.length < 6) cur.push('');
    cur[index] = v;
    this.codOtpValue.set(cur.join(''));
    if (v && index < 5) setTimeout(() => this.focusCodOtpInput(index + 1), 0);
  }

  focusCodOtpInput(index: number): void {
    const list = this.codOtpInputs;
    if (list && index >= 0 && index < list.length) list.get(index)?.nativeElement.focus();
  }

  onCodOtpKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.onCodOtpSubmit();
      return;
    }
    if (event.key === 'Backspace' && !this.getCodOtpDigit(index) && index > 0) {
      const cur = this.codOtpValue().split('');
      cur[index - 1] = '';
      this.codOtpValue.set(cur.join(''));
      setTimeout(() => this.focusCodOtpInput(index - 1), 0);
    }
  }

  onCodOtpSubmit(): void {
    this.codOtpError.set(null);
    const otp = this.codOtpValue().replace(/\D/g, '');
    if (otp.length !== 6) {
      this.codOtpError.set('Vui lòng nhập đủ 6 chữ số.');
      return;
    }
    this.submitting.set(true);
    this.auth.verifyOtp(this.codOtpPhone, otp).subscribe({
      next: () => {
        this.closeCodOtpPopup();
        this.doCreateOrder();
      },
      error: (err) => {
        this.submitting.set(false);
        this.codOtpError.set(err?.error?.message || 'Mã xác thực không đúng. Vui lòng thử lại.');
      },
    });
  }

  resendCodOtp(): void {
    this.codOtpError.set(null);
    this.auth.requestOtp(this.codOtpPhone).subscribe({
      next: (res) => {
        if (res.devOtp) this.toast.showOtp(res.devOtp);
        const expiresAt = Date.now() + 5 * 60 * 1000;
        this.codOtpExpiresAt.set(expiresAt);
        this.startCodCountdown(expiresAt);
      },
      error: (err) => {
        this.codOtpError.set(err?.error?.message || 'Không gửi lại được mã.');
      },
    });
  }
}
