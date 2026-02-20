import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const BASE = `${environment.apiUrl}/auth/addresses`;

export interface Address {
    _id: string;
    label: string;
    fullName: string;
    phone: string;
    city: string;
    district: string;
    ward: string;
    address: string;
    isDefault: boolean;
}

export interface VNLocation {
    name: string;
    code: number;
    division_type: string;
    codename: string;
    districts?: VNLocation[];
    wards?: VNLocation[];
}

interface AddressResponse {
    success: boolean;
    addresses: Address[];
    message?: string;
}

@Injectable({ providedIn: 'root' })
export class AddressService {
    private http = inject(HttpClient);
    private auth = inject(AuthService);

    readonly addresses = signal<Address[]>([]);
    readonly provinces = signal<VNLocation[]>([]);

    private get userId(): string | null {
        const u = this.auth.currentUser();
        return u?._id || u?.id || null;
    }

    loadProvinces(): void {
        if (this.provinces().length === 0) {
            this.http.get<VNLocation[]>('https://provinces.open-api.vn/api/p/').subscribe({
                next: (res) => this.provinces.set(res),
                error: (err) => console.error('Load provinces error', err)
            });
        }
    }

    getDistricts(provinceCode: number) {
        return this.http.get<VNLocation>(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`);
    }

    getWards(districtCode: number) {
        return this.http.get<VNLocation>(`https://provinces.open-api.vn/api/d/${districtCode}?depth=2`);
    }

    /** Load addresses from server */
    load(): void {
        const id = this.userId;
        if (!id) { this.addresses.set([]); return; }

        this.http.get<AddressResponse>(`${BASE}/${id}`).subscribe({
            next: (res) => {
                if (res.success) this.addresses.set(res.addresses || []);
            },
            error: (err) => console.error('Load addresses error', err),
        });
    }

    /** Add a new address */
    add(data: Omit<Address, '_id'>): void {
        const id = this.userId;
        if (!id) return;

        this.http.post<AddressResponse>(BASE, { userId: id, ...data }).subscribe({
            next: (res) => {
                if (res.success) this.addresses.set(res.addresses || []);
            },
            error: (err) => console.error('Add address error', err),
        });
    }

    /** Update an existing address */
    update(addressId: string, data: Partial<Address>): void {
        const id = this.userId;
        if (!id) return;

        this.http.put<AddressResponse>(`${BASE}/${addressId}`, { userId: id, ...data }).subscribe({
            next: (res) => {
                if (res.success) this.addresses.set(res.addresses || []);
            },
            error: (err) => console.error('Update address error', err),
        });
    }

    /** Delete an address */
    remove(addressId: string): void {
        const id = this.userId;
        if (!id) return;

        this.http.delete<AddressResponse>(`${BASE}/${addressId}`, {
            body: { userId: id },
        }).subscribe({
            next: (res) => {
                if (res.success) this.addresses.set(res.addresses || []);
            },
            error: (err) => console.error('Delete address error', err),
        });
    }

    /** Set an address as default */
    setDefault(addressId: string): void {
        const id = this.userId;
        if (!id) return;

        this.http.put<AddressResponse>(`${BASE}/${addressId}/default`, { userId: id }).subscribe({
            next: (res) => {
                if (res.success) this.addresses.set(res.addresses || []);
            },
            error: (err) => console.error('Set default address error', err),
        });
    }

    /** Get the default address */
    getDefault(): Address | null {
        return this.addresses().find(a => a.isDefault) || null;
    }
}
