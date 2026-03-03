import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

const BASE = environment.apiUrl;

// === Product interfaces ===
export interface Product {
  _id?: string;
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  price: number;
  salePrice?: number;
  category?: string | { _id: string; name: string; slug?: string };
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

// === Category interface ===
export interface Category {
  _id?: string;
  name: string;
  slug?: string;
  parent?: string | null;
  order?: number;
  active?: boolean;
}

// === Blog interfaces ===
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
  createdAt?: string;
}

export interface BlogsListResponse {
  items: BlogPost[];
  total: number;
  page: number;
  limit: number;
}

// === Order interfaces ===
export interface OrderItemProduct {
  _id: string;
  name?: string;
  slug?: string;
  images?: { url: string; alt?: string }[];
}

export interface OrderItem {
  _id?: string;
  product?: OrderItemProduct | string;
  name: string;
  price: number;
  qty: number;
}

export interface OrderUser {
  _id: string;
  phoneNumber?: string;
  email?: string;
  username?: string;
  profile?: { fullName?: string; dateOfBirth?: string; gender?: string };
}

export interface Order {
  _id?: string;
  orderNumber: string;
  user?: OrderUser;
  items: OrderItem[];
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    district?: string;
    ward?: string;
    note?: string;
  };
  status: string;
  total: number;
  shippingFee?: number;
  discount?: number;
  createdAt?: string;
}

export interface OrdersListResponse {
  items: Order[];
  total: number;
  page: number;
  limit: number;
}

// === User interfaces ===
export interface User {
  _id?: string;
  phoneNumber: string;
  email?: string;
  username?: string;
  profile?: { fullName?: string; dateOfBirth?: string; gender?: string };
  addresses?: { _id?: string; label?: string; fullName?: string; phone?: string; address?: string; ward?: string; district?: string; city?: string; isDefault?: boolean }[];
  avatar?: string;
  active?: boolean;
  lastLogin?: string;
  createdAt?: string;
  orderCount?: number;
  totalSpent?: number;
  recentOrders?: Order[];
}

export interface UsersListResponse {
  items: User[];
  total: number;
  page: number;
  limit: number;
}

// === Dashboard interfaces ===
export interface OrderChartPoint {
  _id: string;
  count: number;
}

export interface RevenueChartPoint {
  _id: string;
  revenue: number;
}

export interface TopProductPoint {
  _id: string;
  totalQty: number;
  totalRevenue: number;
}

export interface DashboardStats {
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  totalOrders: number;
  ordersThisMonth: number;
  ordersLastMonth: number;
  ordersByStatus: Record<string, number>;
  totalUsers: number;
  totalProducts: number;
  recentOrders: Order[];
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  constructor(private http: HttpClient) {}

  // ======== Dashboard ========
  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${BASE}/admin/dashboard/stats`);
  }

  getOrderChart(days = 7): Observable<OrderChartPoint[]> {
    return this.http.get<OrderChartPoint[]>(`${BASE}/admin/dashboard/chart/orders`, {
      params: { days: days.toString() },
    });
  }

  getRevenueChart(months = 6): Observable<RevenueChartPoint[]> {
    return this.http.get<RevenueChartPoint[]>(`${BASE}/admin/dashboard/chart/revenue`, {
      params: { months: months.toString() },
    });
  }

  getTopProducts(limit = 5): Observable<TopProductPoint[]> {
    return this.http.get<TopProductPoint[]>(`${BASE}/admin/dashboard/top-products`, {
      params: { limit: limit.toString() },
    });
  }

  // ======== Products ========
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

  // ======== Categories ========
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

  // ======== Blogs ========
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

  // ======== Orders ========
  getOrders(params?: { page?: number; limit?: number; status?: string; search?: string; from?: string; to?: string }): Observable<OrdersListResponse> {
    let p = new HttpParams();
    if (params?.page != null) p = p.set('page', params.page.toString());
    if (params?.limit != null) p = p.set('limit', params.limit.toString());
    if (params?.status) p = p.set('status', params.status);
    if (params?.search) p = p.set('search', params.search);
    if (params?.from) p = p.set('from', params.from);
    if (params?.to) p = p.set('to', params.to);
    return this.http.get<OrdersListResponse>(`${BASE}/admin/orders`, { params: p });
  }

  getOrder(orderNumber: string): Observable<Order> {
    return this.http.get<Order>(`${BASE}/admin/orders/${orderNumber}`);
  }

  updateOrderStatus(orderNumber: string, status: string): Observable<Order> {
    return this.http.put<Order>(`${BASE}/admin/orders/${orderNumber}/status`, { status });
  }

  // ======== Users ========
  getUsers(params?: { page?: number; limit?: number; search?: string }): Observable<UsersListResponse> {
    let p = new HttpParams();
    if (params?.page != null) p = p.set('page', params.page.toString());
    if (params?.limit != null) p = p.set('limit', params.limit.toString());
    if (params?.search) p = p.set('search', params.search);
    return this.http.get<UsersListResponse>(`${BASE}/admin/users`, { params: p });
  }

  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${BASE}/admin/users/${id}`);
  }
}
