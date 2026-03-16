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
  description_html?: string;
  price: number;
  salePrice?: number;
  old_price?: number;
  category?: string | number | { _id: string | number; name: string; slug?: string } | null;
  category_id?: string;
  primaryCategoryId?: number | null;
  categoryIds?: number[];
  images?: { url: string; alt?: string }[];
  specs?: Record<string, unknown>;
  techSpecs?: Record<string, unknown>;
  brand?: string;
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
  _id?: string | number;
  category_id?: string;
  name: string;
  slug?: string;
  parent_id?: string | number | null;
  level?: number;
  product_count?: number;
  description?: string;
  image?: string;
  is_active?: boolean;
  display_order?: number;
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
  paymentMethod?: 'cod' | 'qr' | 'momo' | 'zalopay' | 'atm';
  isPaid?: boolean;
  paidAt?: string;
  shippingFee?: number;
  discount?: number;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancelRequest?: {
    status?: 'none' | 'pending' | 'approved' | 'rejected';
    reason?: string;
    requestedAt?: string;
    resolvedAt?: string;
    note?: string;
  };
  returnRequest?: {
    status?: 'none' | 'pending' | 'approved' | 'rejected';
    reason?: string;
    requestedAt?: string;
    resolvedAt?: string;
    note?: string;
  };
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

export interface AdminNotification {
  _id: string;
  type: 'order_new' | 'order_cancel_request' | 'order_return_request' | 'order_delivered';
  order?: string;
  orderNumber: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  readBy?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminNotificationsResponse {
  items: AdminNotification[];
  unreadCount: number;
}

// === Dashboard interfaces ===
export interface OrderChartPoint {
  _id: string;
  count: number;
}

export interface RevenueChartPoint {
  _id: string;
  label?: string;
  revenue: number;
  orders: number;
  newCustomers: number;
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
  usersThisMonth: number;
  usersLastMonth: number;
}

// === AuraHub interfaces ===
export interface HubPost {
  _id?: string;
  content: string;
  images?: string[];
  topic?: string;
  status?: 'pending' | 'approved' | 'rejected';
  rejectedReason?: string | null;
  replyOption?: 'anyone' | 'followers' | 'mentioned';
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  repostCount?: number;
  viewCount?: number;
  scheduledAt?: string | null;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
  author?: {
    _id: string;
    username?: string;
    phoneNumber?: string;
    avatar?: string;
    profile?: { fullName?: string };
  };
}

export interface HubComment {
  _id: string;
  post: string;
  content: string;
  images?: string[];
  likeCount?: number;
  replyCount?: number;
  parentComment?: string | null;
  createdAt?: string;
  updatedAt?: string;
  author?: {
    _id: string;
    username?: string;
    phoneNumber?: string;
    avatar?: string;
    profile?: { fullName?: string };
  };
  replies?: HubComment[];
}

export interface HubPostsListResponse {
  items: HubPost[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
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

  getRevenueChart(months = 12): Observable<RevenueChartPoint[]> {
    return this.http.get<RevenueChartPoint[]>(`${BASE}/admin/dashboard/chart/revenue`, {
      params: { months: months.toString() },
    });
  }

  getWeeklyRevenueChart(): Observable<RevenueChartPoint[]> {
    return this.http.get<RevenueChartPoint[]>(`${BASE}/admin/dashboard/chart/revenue-weekly`);
  }

  getTopProducts(limit = 5): Observable<TopProductPoint[]> {
    return this.http.get<TopProductPoint[]>(`${BASE}/admin/dashboard/top-products`, {
      params: { limit: limit.toString() },
    });
  }

  // ======== Products ========
  getProducts(params?: { page?: number; limit?: number; category?: string; search?: string; stockStatus?: string }): Observable<ProductsListResponse> {
    let p = new HttpParams();
    if (params?.page != null) p = p.set('page', params.page.toString());
    if (params?.limit != null) p = p.set('limit', params.limit.toString());
    if (params?.category) p = p.set('category', params.category);
    if (params?.search) p = p.set('search', params.search);
    if (params?.stockStatus) p = p.set('stockStatus', params.stockStatus);
    return this.http.get<ProductsListResponse>(`${BASE}/admin/products`, { params: p });
  }

  getCategoryStats(): Observable<{ stats: { name: string; count: number }[]; total: number }> {
    return this.http.get<{ stats: { name: string; count: number }[]; total: number }>(`${BASE}/admin/products/category-stats`);
  }

  getStockStats(): Observable<{ stats: { name: string; count: number }[]; total: number }> {
    return this.http.get<{ stats: { name: string; count: number }[]; total: number }>(`${BASE}/admin/products/stock-stats`);
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

  cancelOrder(orderNumber: string, reason?: string): Observable<Order> {
    return this.http.put<Order>(`${BASE}/admin/orders/${orderNumber}/cancel`, { reason });
  }

  resolveCancelRequest(orderNumber: string, action: 'approve' | 'reject', note?: string): Observable<Order> {
    return this.http.put<Order>(`${BASE}/admin/orders/${orderNumber}/cancel-request`, { action, note });
  }

  resolveReturnRequest(orderNumber: string, action: 'approve' | 'reject', note?: string): Observable<Order> {
    return this.http.put<Order>(`${BASE}/admin/orders/${orderNumber}/return-request`, { action, note });
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

  // ======== Notifications ========
  getNotifications(limit = 20, unreadOnly = false): Observable<AdminNotificationsResponse> {
    return this.http.get<AdminNotificationsResponse>(`${BASE}/admin/notifications`, {
      params: { limit: limit.toString(), unreadOnly: unreadOnly ? 'true' : 'false' },
    });
  }

  markNotificationRead(id: string): Observable<AdminNotification> {
    return this.http.patch<AdminNotification>(`${BASE}/admin/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(): Observable<{ success: boolean; modifiedCount: number }> {
    return this.http.patch<{ success: boolean; modifiedCount: number }>(`${BASE}/admin/notifications/read-all`, {});
  }

  // ======== AuraHub moderation ========
  getHubPosts(params?: {
    page?: number;
    limit?: number;
    status?: string;
    topic?: string;
    search?: string;
    sort?: 'newest' | 'trending';
  }): Observable<HubPostsListResponse> {
    let p = new HttpParams();
    if (params?.page != null) p = p.set('page', params.page.toString());
    if (params?.limit != null) p = p.set('limit', params.limit.toString());
    if (params?.status) p = p.set('status', params.status);
    if (params?.topic) p = p.set('topic', params.topic);
    if (params?.search) p = p.set('search', params.search);
    if (params?.sort) p = p.set('sort', params.sort);
    return this.http.get<HubPostsListResponse>(`${BASE}/admin/hub/posts`, { params: p });
  }

  getHubPostDetail(id: string): Observable<HubPost> {
    return this.http.get<HubPost>(`${BASE}/admin/hub/posts/${id}`);
  }

  approveHubPost(id: string, forcePublishNow?: boolean): Observable<HubPost> {
    const body = forcePublishNow ? { forcePublishNow: true } : {};
    return this.http.patch<HubPost>(`${BASE}/admin/hub/posts/${id}/approve`, body);
  }

  rejectHubPost(id: string, reason: string): Observable<HubPost> {
    return this.http.patch<HubPost>(`${BASE}/admin/hub/posts/${id}/reject`, { reason });
  }

  deleteHubPost(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/admin/hub/posts/${id}`);
  }

  getHubPostComments(postId: string): Observable<HubComment[]> {
    return this.http.get<HubComment[]>(`${BASE}/admin/hub/posts/${postId}/comments`);
  }

  deleteHubComment(commentId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/admin/hub/comments/${commentId}`);
  }

  // ======== Promotions ========

  getPromotions(params?: { page?: number; limit?: number; search?: string }): Observable<{ items: Promotion[]; total: number; page: number; limit: number }> {
    let hp = new HttpParams();
    if (params?.page) hp = hp.set('page', String(params.page));
    if (params?.limit) hp = hp.set('limit', String(params.limit));
    if (params?.search) hp = hp.set('search', params.search);
    return this.http.get<{ items: Promotion[]; total: number; page: number; limit: number }>(`${BASE}/admin/promotions`, { params: hp });
  }

  getPromotion(id: string): Observable<Promotion> {
    return this.http.get<Promotion>(`${BASE}/admin/promotions/${id}`);
  }

  createPromotion(body: Partial<Promotion>): Observable<Promotion> {
    return this.http.post<Promotion>(`${BASE}/admin/promotions`, body);
  }

  updatePromotion(id: string, body: Partial<Promotion>): Observable<Promotion> {
    return this.http.put<Promotion>(`${BASE}/admin/promotions/${id}`, body);
  }

  deletePromotion(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${BASE}/admin/promotions/${id}`);
  }
}

export interface Promotion {
  _id?: string;
  code: string;
  description?: string;
  discountPercent: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number;
  maxUsage?: number | null;
  usedCount?: number;
  maxUsagePerUser?: number;
  startDate: string;
  endDate: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
