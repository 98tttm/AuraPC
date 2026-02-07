import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

const BASE = environment.apiUrl;

export interface Product {
  _id?: string;
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  price: number;
  salePrice?: number;
  category?: string;
  images?: { url: string; alt?: string }[];
  specs?: Record<string, unknown>;
  stock?: number;
  featured?: boolean;
  active?: boolean;
}

export interface ProductsListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface Category {
  _id?: string;
  name: string;
  slug?: string;
  parent?: string | null;
  order?: number;
  active?: boolean;
}

export interface BlogPost {
  _id?: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImage?: string;
  author?: string;
  published?: boolean;
  publishedAt?: string;
}

export interface BlogsListResponse {
  items: BlogPost[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  constructor(private http: HttpClient) {}

  // Products
  getProducts(params?: { page?: number; limit?: number; category?: string; search?: string }): Observable<ProductsListResponse> {
    let p = new HttpParams();
    if (params?.page != null) p = p.set('page', params.page.toString());
    if (params?.limit != null) p = p.set('limit', params.limit.toString());
    if (params?.category) p = p.set('category', params.category);
    if (params?.search) p = p.set('search', params.search);
    return this.http.get<ProductsListResponse>(`${BASE}/admin/products`, { params: p });
  }
  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`${BASE}/admin/products/${id}`);
  }
  createProduct(body: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(`${BASE}/admin/products`, body);
  }
  updateProduct(id: string, body: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${BASE}/admin/products/${id}`, body);
  }
  deleteProduct(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${BASE}/admin/products/${id}`);
  }

  // Categories
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${BASE}/admin/categories`);
  }
  getCategory(id: string): Observable<Category> {
    return this.http.get<Category>(`${BASE}/admin/categories/${id}`);
  }
  createCategory(body: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${BASE}/admin/categories`, body);
  }
  updateCategory(id: string, body: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${BASE}/admin/categories/${id}`, body);
  }
  deleteCategory(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${BASE}/admin/categories/${id}`);
  }

  // Blogs
  getBlogs(page = 1, limit = 20): Observable<BlogsListResponse> {
    return this.http.get<BlogsListResponse>(`${BASE}/admin/blogs`, {
      params: { page: page.toString(), limit: limit.toString() },
    });
  }
  getBlog(id: string): Observable<BlogPost> {
    return this.http.get<BlogPost>(`${BASE}/admin/blogs/${id}`);
  }
  createBlog(body: Partial<BlogPost>): Observable<BlogPost> {
    return this.http.post<BlogPost>(`${BASE}/admin/blogs`, body);
  }
  updateBlog(id: string, body: Partial<BlogPost>): Observable<BlogPost> {
    return this.http.put<BlogPost>(`${BASE}/admin/blogs/${id}`, body);
  }
  deleteBlog(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${BASE}/admin/blogs/${id}`);
  }
}
