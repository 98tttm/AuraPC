import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AddressService, Address, VNLocation } from '../../core/services/address.service';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPageComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly addressService = inject(AddressService);

  readonly user = this.auth.currentUser;
  activeTab = signal<'profile' | 'orders' | 'address'>('profile');
  editMode = signal(false);

  // Edit form fields
  editName = '';
  editGender = '';
  editDob = '';
  editAvatar = '';

  // Mock orders data
  mockOrders = [
    { id: 'ORD-20260115001', date: '15/01/2026', status: 'Đã giao', total: 25890000, items: 2 },
    { id: 'ORD-20260108002', date: '08/01/2026', status: 'Đang vận chuyển', total: 15200000, items: 1 },
    { id: 'ORD-20251228003', date: '28/12/2025', status: 'Đã giao', total: 42500000, items: 3 },
  ];

  // Address modal
  showAddressModal = signal(false);
  addressModalMode = signal<'add' | 'edit'>('add');
  editingAddressId = '';

  // Address form fields
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

  // Delete modal
  showDeleteModal = signal(false);

  constructor() {
    if (!this.auth.currentUser()) {
      this.router.navigate(['/'], { queryParams: { login: '1' } });
    } else {
      this.addressService.loadProvinces();
    }
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
    const map: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };
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
    return price.toLocaleString('vi-VN') + '₫';
  }

  switchTab(tab: 'profile' | 'orders' | 'address') {
    this.activeTab.set(tab);
    this.editMode.set(false);
    if (tab === 'address') {
      this.addressService.load();
    }
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
        error: (err) => alert('Lỗi upload ảnh: ' + (err.message || 'Không xác định'))
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
      error: (err) => alert('Lỗi cập nhật: ' + (err.message || 'Không xác định'))
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  getStatusClass(status: string): string {
    if (status === 'Đã giao') return 'status--delivered';
    if (status === 'Đang vận chuyển') return 'status--shipping';
    if (status === 'Đã hủy') return 'status--cancelled';
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
    this.addrLabel = 'Nhà riêng';
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
      alert('Vui lòng nhập họ tên và số điện thoại.');
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
}
