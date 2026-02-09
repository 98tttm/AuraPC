import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

const BASE = environment.apiUrl;

/** Ảnh: API trả về string[] (URL) hoặc { url, alt }[] */
export type ProductImage = string | { url: string; alt?: string };

export interface Product {
  _id?: string;
  product_id?: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  description_html?: string;
  price: number;
  /** Giá gốc (khi giảm giá); % giảm = (old_price - price) / old_price * 100 */
  old_price?: number | null;
  salePrice?: number | null;
  category?: { _id?: string; category_id?: string; name: string; slug: string };
  category_id?: string;
  category_ids?: string[];
  images: ProductImage[] | string[];
  specs?: Record<string, string>;
  techSpecs?: Record<string, unknown>;
  brand?: string;
  stock?: number;
  featured?: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Lấy URL ảnh chính từ product (hỗ trợ images là string[] hoặc {url}[]). */
export function productMainImage(p: Product): string {
  if (!p?.images?.length) return '';
  const first = p.images[0];
  return typeof first === 'string' ? first : (first as { url?: string })?.url ?? '';
}

/** Giá hiển thị: price (đã là giá bán); nếu có old_price thì đó là giá gốc. */
export function productDisplayPrice(p: Product): number {
  return p?.price ?? 0;
}

/** Có giảm giá khi có old_price > price, hoặc (schema cũ) salePrice < price. */
export function productHasSale(p: Product): boolean {
  if (p?.old_price != null && p.old_price > 0 && (p?.price ?? 0) < p.old_price) return true;
  const sale = p?.salePrice;
  return sale != null && sale > 0 && sale < (p?.price ?? 0);
}

/** % giảm (làm tròn). */
export function productSalePercent(p: Product): number {
  if (productHasSale(p)) {
    if (p.old_price != null && p.old_price > 0)
      return Math.round(((p.old_price - (p.price ?? 0)) / p.old_price) * 100);
    if (p.salePrice != null && p.price != null && p.price > 0)
      return Math.round(((p.price - p.salePrice) / p.price) * 100);
  }
  return 0;
}

export type ProductSort = 'featured' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'newest' | 'best_seller';

export interface ProductsResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface Category {
  _id?: string;
  category_id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  level?: number;
  display_order?: number;
  is_active?: boolean;
  order?: number;
  parent?: string;
  active?: boolean;
}

export interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  coverImage?: string;
  author?: string;
  published?: boolean;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlogsResponse {
  items: BlogPost[];
  total: number;
  page: number;
  limit: number;
}

/** Response từ /api/products/filter-options */
export interface FilterOptionsResponse {
  brands: string[];
  specs: {
    cpu: string[];
    gpu: string[];
    ram: string[];
    storage: string[];
    screenInch: string[];
    cpuSeries: string[];
    cpuSocket: string[];
    cpuCores: string[];
    mbSocket: string[];
    mbRamType: string[];
    mbChipset: string[];
    ramType: string[];
    ramCapacity: string[];
    ramBus: string[];
    ssdCapacity: string[];
    ssdInterface: string[];
    ssdForm: string[];
    vgaSeries: string[];
    vram: string[];
    kbSwitch: string[];
    kbLayout: string[];
    kbConnection: string[];
    mouseDpi: string[];
    mouseWeight: string[];
    mouseConnection: string[];
  };
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) { }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${BASE}/categories`);
  }

  /** Báo cáo danh mục: tất cả categories + số sản phẩm mỗi danh mục (test data / cấu trúc web) */
  getCategoriesReport(): Observable<{
    summary: { totalCategories: number; totalProducts: number; productsWithoutCategory: number };
    categories: (Category & { productCount: number })[];
  }> {
    return this.http.get<{
      summary: { totalCategories: number; totalProducts: number; productsWithoutCategory: number };
      categories: (Category & { productCount: number })[];
    }>(`${BASE}/categories/report`);
  }

  getProducts(params?: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    featured?: boolean;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: ProductSort;
    cpu?: string;
    gpu?: string;
    screenInch?: string;
    storage?: string;
    ram?: string;
    // CPU chi tiết
    cpuSeries?: string;
    cpuSocket?: string;
    cpuCores?: string;
    // Mainboard
    mbSocket?: string;
    mbRamType?: string;
    mbChipset?: string;
    // RAM
    ramType?: string;
    ramCapacity?: string;
    ramBus?: string;
    // SSD
    ssdCapacity?: string;
    ssdInterface?: string;
    ssdForm?: string;
    // VGA
    vgaSeries?: string;
    vram?: string;
    // Bàn phím
    kbSwitch?: string;
    kbLayout?: string;
    kbConnection?: string;
    // Chuột
    mouseDpi?: string;
    mouseWeight?: string;
    mouseConnection?: string;
  }): Observable<ProductsResponse> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.page != null) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit != null) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.featured) httpParams = httpParams.set('featured', 'true');
      if (params.brand) httpParams = httpParams.set('brand', params.brand);
      if (params.minPrice != null) httpParams = httpParams.set('minPrice', params.minPrice.toString());
      if (params.maxPrice != null) httpParams = httpParams.set('maxPrice', params.maxPrice.toString());
      if (params.sort) httpParams = httpParams.set('sort', params.sort);
      if (params.cpu) httpParams = httpParams.set('cpu', params.cpu);
      if (params.gpu) httpParams = httpParams.set('gpu', params.gpu);
      if (params.screenInch) httpParams = httpParams.set('screenInch', params.screenInch);
      if (params.storage) httpParams = httpParams.set('storage', params.storage);
      if (params.ram) httpParams = httpParams.set('ram', params.ram);
      if (params.cpuSeries) httpParams = httpParams.set('cpuSeries', params.cpuSeries);
      if (params.cpuSocket) httpParams = httpParams.set('cpuSocket', params.cpuSocket);
      if (params.cpuCores) httpParams = httpParams.set('cpuCores', params.cpuCores);
      if (params.mbSocket) httpParams = httpParams.set('mbSocket', params.mbSocket);
      if (params.mbRamType) httpParams = httpParams.set('mbRamType', params.mbRamType);
      if (params.mbChipset) httpParams = httpParams.set('mbChipset', params.mbChipset);
      if (params.ramType) httpParams = httpParams.set('ramType', params.ramType);
      if (params.ramCapacity) httpParams = httpParams.set('ramCapacity', params.ramCapacity);
      if (params.ramBus) httpParams = httpParams.set('ramBus', params.ramBus);
      if (params.ssdCapacity) httpParams = httpParams.set('ssdCapacity', params.ssdCapacity);
      if (params.ssdInterface) httpParams = httpParams.set('ssdInterface', params.ssdInterface);
      if (params.ssdForm) httpParams = httpParams.set('ssdForm', params.ssdForm);
      if (params.vgaSeries) httpParams = httpParams.set('vgaSeries', params.vgaSeries);
      if (params.vram) httpParams = httpParams.set('vram', params.vram);
      if (params.kbSwitch) httpParams = httpParams.set('kbSwitch', params.kbSwitch);
      if (params.kbLayout) httpParams = httpParams.set('kbLayout', params.kbLayout);
      if (params.kbConnection) httpParams = httpParams.set('kbConnection', params.kbConnection);
      if (params.mouseDpi) httpParams = httpParams.set('mouseDpi', params.mouseDpi);
      if (params.mouseWeight) httpParams = httpParams.set('mouseWeight', params.mouseWeight);
      if (params.mouseConnection) httpParams = httpParams.set('mouseConnection', params.mouseConnection);
    }
    return this.http.get<ProductsResponse>(`${BASE}/products`, { params: httpParams });
  }

  getFeaturedProducts(limit = 8): Observable<Product[]> {
    return this.http.get<Product[]>(`${BASE}/products/featured`, {
      params: { limit: limit.toString() },
    });
  }

  /** Response từ /api/products/filter-options */
  getFilterOptions(category?: string): Observable<FilterOptionsResponse> {
    let httpParams = new HttpParams();
    if (category) {
      httpParams = httpParams.set('category', category);
    }
    return this.http.get<FilterOptionsResponse>(`${BASE}/products/filter-options`, { params: httpParams });
  }

  getProductBySlug(slug: string): Observable<Product> {
    return this.http.get<Product>(`${BASE}/products/by-slug/${encodeURIComponent(slug)}`);
  }

  getBlogs(page = 1, limit = 10): Observable<BlogsResponse> {
    return this.http.get<BlogsResponse>(`${BASE}/blogs`, {
      params: { page: page.toString(), limit: limit.toString() },
    });
  }

  getBlogBySlug(slug: string): Observable<BlogPost> {
    return this.http.get<BlogPost>(`${BASE}/blogs/by-slug/${encodeURIComponent(slug)}`);
  }

  createOrder(body: {
    items: { product: string; name: string; price: number; qty: number }[];
    shippingAddress?: Record<string, string>;
    shippingFee?: number;
    discount?: number;
  }): Observable<{ _id: string; orderNumber: string; total: number }> {
    return this.http.post<{ _id: string; orderNumber: string; total: number }>(`${BASE}/orders`, body);
  }

  getOrder(orderNumber: string): Observable<unknown> {
    return this.http.get(`${BASE}/orders/${encodeURIComponent(orderNumber)}`);
  }
}
