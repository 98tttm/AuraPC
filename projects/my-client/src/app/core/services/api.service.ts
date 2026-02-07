import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

const BASE = environment.apiUrl;

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price: number;
  salePrice?: number;
  category?: { _id: string; name: string; slug: string };
  images: { url: string; alt?: string }[];
  specs?: Record<string, unknown>;
  stock?: number;
  featured?: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductsResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  parent?: string;
  order?: number;
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

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${BASE}/categories`);
  }

  getProducts(params?: { category?: string; search?: string; page?: number; limit?: number; featured?: boolean }): Observable<ProductsResponse> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.page != null) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit != null) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.featured) httpParams = httpParams.set('featured', 'true');
    }
    return this.http.get<ProductsResponse>(`${BASE}/products`, { params: httpParams });
  }

  getFeaturedProducts(limit = 8): Observable<Product[]> {
    return this.http.get<Product[]>(`${BASE}/products/featured`, {
      params: { limit: limit.toString() },
    });
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
