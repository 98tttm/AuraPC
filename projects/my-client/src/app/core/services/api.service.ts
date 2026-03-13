import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

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
  rating?: number;
  reviewCount?: number;
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

/** Order list item (from GET /api/orders?userId=...) */
export interface OrderListItem {
  _id: string;
  orderNumber: string;
  user?: string | null;
  items: { product?: { _id: string; name?: string; slug?: string; images?: ProductImage[] }; name: string; price: number; qty: number }[];
  shippingAddress?: Record<string, string>;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod?: 'cod' | 'qr' | 'momo' | 'zalopay' | 'atm';
  isPaid?: boolean;
  paidAt?: string;
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
  total: number;
  shippingFee?: number;
  discount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Kết quả tra cứu đơn (GET /api/orders/track/:orderNumber) - đầy đủ thông tin */
export type TrackOrderResult = Omit<OrderListItem, 'user'>;

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
  /** Slug danh mục bài viết, ví dụ: 'huong-dan-thu-thuat', 'tin-tuc-cong-nghe' */
  category?: string;
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

/** Review/Comment từ API */
export interface ProductReviewItem {
  _id: string;
  product: string;
  user: { _id: string; profile?: { fullName?: string }; phoneNumber?: string; username?: string };
  type: 'review' | 'comment';
  rating?: number;
  content: string;
  images?: string[];
  parent?: string | null;
  replies?: ProductReviewItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface ProductReviewsResponse {
  items: ProductReviewItem[];
  total: number;
  avgRating: number;
  ratingBars: { star: number; count: number }[];
  reviewCount: number;
  commentCount: number;
}

export interface CanReviewResponse {
  canReview: boolean;
  alreadyReviewed: boolean;
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

  /** Gửi yêu cầu thanh toán MoMo (Ví MoMo hoặc thẻ ATM NAPAS) */
  createMoMoPayment(payload: {
    items: { product: string; name: string; price: number; qty: number }[];
    shippingAddress: Record<string, string>;
    paymentMethod: string;
    directDiscount?: number;
  }): Observable<{ success: boolean; payUrl: string }> {
    return this.http.post<{ success: boolean; payUrl: string }>(`${BASE}/payment/momo/create`, payload);
  }

  createOrder(body: {
    items: { product: string; name: string; price: number; qty: number }[];
    shippingAddress?: Record<string, string>;
    shippingFee?: number;
    discount?: number;
    paymentMethod?: 'cod' | 'qr' | 'momo' | 'zalopay' | 'atm';
    isPaid?: boolean;
    user?: string;
    requestInvoice?: boolean;
    invoiceEmail?: string;
    invoiceType?: 'personal' | 'company';
  }): Observable<{ _id: string; orderNumber: string; total: number }> {
    return this.http.post<{ _id: string; orderNumber: string; total: number }>(`${BASE}/orders`, body);
  }

  /** List orders for a user. Optional status filter (pending, confirmed, processing, shipped, delivered, cancelled, or 'all'). */
  getOrdersByUser(userId: string, status?: string): Observable<OrderListItem[]> {
    let url = `${BASE}/orders?userId=${encodeURIComponent(userId)}`;
    if (status && status !== 'all') url += `&status=${encodeURIComponent(status)}`;
    return this.http.get<OrderListItem[]>(url);
  }

  // ─── AUTH / USER SOCIAL (FOLLOW) ───

  toggleFollow(targetUserId: string): Observable<{ success: boolean; following: boolean; followerCount: number; followingCount: number }> {
    return this.http.post<{ success: boolean; following: boolean; followerCount: number; followingCount: number }>(
      `${BASE}/auth/follow/${encodeURIComponent(targetUserId)}`,
      {}
    );
  }

  getFollowers(userId: string): Observable<{ success: boolean; followerCount: number; followers: any[] }> {
    return this.http.get<{ success: boolean; followerCount: number; followers: any[] }>(
      `${BASE}/auth/followers/${encodeURIComponent(userId)}`
    );
  }

  getFollowing(userId: string): Observable<{ success: boolean; followingCount: number; following: any[] }> {
    return this.http.get<{ success: boolean; followingCount: number; following: any[] }>(
      `${BASE}/auth/following/${encodeURIComponent(userId)}`
    );
  }

  getOrder(orderNumber: string): Observable<OrderListItem> {
    return this.http.get<OrderListItem>(`${BASE}/orders/${encodeURIComponent(orderNumber)}`);
  }

  /** Tra cứu đơn theo mã đơn (không cần đăng nhập), trả về đầy đủ thông tin đơn */
  trackOrder(orderNumber: string): Observable<Omit<OrderListItem, 'user'>> {
    const num = orderNumber.trim().replace(/^ORD\-/i, '').toUpperCase();
    return this.http.get<Omit<OrderListItem, 'user'>>(`${BASE}/orders/track/${encodeURIComponent(num)}`);
  }

  requestOrderCancellation(orderNumber: string, reason?: string): Observable<OrderListItem> {
    return this.http.post<OrderListItem>(`${BASE}/orders/${encodeURIComponent(orderNumber)}/cancel-request`, {
      reason: reason || '',
    });
  }

  confirmOrderReceived(orderNumber: string): Observable<OrderListItem> {
    return this.http.post<OrderListItem>(`${BASE}/orders/${encodeURIComponent(orderNumber)}/confirm-received`, {});
  }

  requestOrderReturn(orderNumber: string, reason?: string): Observable<OrderListItem> {
    return this.http.post<OrderListItem>(`${BASE}/orders/${encodeURIComponent(orderNumber)}/return-request`, {
      reason: reason || '',
    });
  }

  /** Builder PC - lấy cấu hình theo id (ObjectId) hoặc shareId */
  getBuilder(id: string): Observable<{
    _id: string;
    shareId?: string;
    components: Record<string, { product?: string; name?: string; slug?: string; price?: number; images?: unknown; specs?: Record<string, string> }>;
    createdAt?: string;
    updatedAt?: string;
  }> {
    return this.http.get<{
      _id: string;
      shareId?: string;
      components: Record<string, { product?: string; name?: string; slug?: string; price?: number; images?: unknown; specs?: Record<string, string> }>;
      createdAt?: string;
      updatedAt?: string;
    }>(`${BASE}/builders/${encodeURIComponent(id)}`);
  }

  /** Tạo builder mới */
  createBuilder(components?: Record<string, unknown>): Observable<{ _id: string; shareId: string }> {
    return this.http.post<{ _id: string; shareId: string }>(`${BASE}/builders`, { components: components || {} });
  }

  /** Cập nhật 1 component trong builder */
  updateBuilderComponent(
    id: string,
    step: string,
    product: { _id?: string; name: string; slug: string; price: number; images?: unknown; specs?: Record<string, string>; techSpecs?: unknown }
  ): Observable<{ _id: string; shareId: string; components?: Record<string, unknown> }> {
    return this.http.put<{ _id: string; shareId: string; components?: Record<string, unknown> }>(
      `${BASE}/builders/${encodeURIComponent(id)}`,
      { step, product }
    );
  }

  /** Lưụ lại ảnh AuraVisual cho builder */
  updateBuilderAuraVisual(id: string, imageUrl: string): Observable<{ success: boolean; auraVisualImage: string }> {
    return this.http.put<{ success: boolean; auraVisualImage: string }>(
      `${BASE}/builders/${encodeURIComponent(id)}/auravisual`,
      { imageUrl }
    );
  }

  /** Danh sách đánh giá & bình luận sản phẩm. rating: 1-5 lọc theo sao; sort: newest | oldest */
  getProductReviews(
    productId: string,
    filter: 'all' | 'newest' | 'with_photo' = 'all',
    type: 'all' | 'review' | 'comment' = 'all',
    options?: { rating?: number; sort?: 'newest' | 'oldest' }
  ): Observable<ProductReviewsResponse> {
    let params = new HttpParams().set('productId', productId).set('filter', filter);
    if (type !== 'all') params = params.set('type', type);
    if (options?.rating != null && options.rating >= 1 && options.rating <= 5) params = params.set('rating', String(options.rating));
    if (options?.sort) params = params.set('sort', options.sort);
    return this.http.get<ProductReviewsResponse>(`${BASE}/reviews`, { params });
  }

  /** Kiểm tra user có được đánh giá (đã mua + đã nhận hàng) */
  canReview(productId: string): Observable<CanReviewResponse> {
    return this.http.get<CanReviewResponse>(`${BASE}/reviews/can-review`, {
      params: { productId },
    });
  }

  /** Tạo đánh giá (có sao) hoặc bình luận */
  createReviewComment(body: {
    productId: string;
    type: 'review' | 'comment';
    content: string;
    rating?: number;
    images?: string[];
  }): Observable<ProductReviewItem> {
    return this.http.post<ProductReviewItem>(`${BASE}/reviews`, body);
  }

  /** Phản hồi (reply) vào review/comment */
  addReviewReply(reviewId: string, content: string): Observable<ProductReviewItem> {
    return this.http.post<ProductReviewItem>(`${BASE}/reviews/${encodeURIComponent(reviewId)}/reply`, {
      content,
    });
  }

  /** Ping backend gốc (timeout 65s cho Render cold start khi bấm Kiểm tra kết nối) */
  pingBackend(timeoutMs = 65000): Observable<unknown> {
    const root = BASE.replace(/\/api\/?$/, '');
    return this.http.get(root + '/', { responseType: 'text' }).pipe(timeout(timeoutMs));
  }

  /** Gửi PDF cấu hình qua email (timeout 120s: Render cold start + PDF + SMTP) */
  emailBuilderPdf(id: string, email: string): Observable<{ success: boolean; message?: string }> {
    return this.http.post<{ success: boolean; message?: string }>(
      `${BASE}/builders/${encodeURIComponent(id)}/email-pdf`,
      { email }
    ).pipe(timeout(120000));
  }

  triggerAuraVisual(payload: {
    components: { type: string; name: string; image: string }[];
  }): Observable<any> {
    return this.http.post<any>(`${BASE}/chat/auravisual`, payload).pipe(timeout(120000));
  }

  // ─── AURAHUB API ──────────────────────────────────────

  getHubPosts(params: { page?: number; limit?: number; topic?: string; sort?: string } = {}): Observable<{
    posts: any[]; total: number; page: number; totalPages: number;
  }> {
    let hp = new HttpParams();
    if (params.page) hp = hp.set('page', String(params.page));
    if (params.limit) hp = hp.set('limit', String(params.limit));
    if (params.topic) hp = hp.set('topic', params.topic);
    if (params.sort) hp = hp.set('sort', params.sort);
    return this.http.get<any>(`${BASE}/hub/posts`, { params: hp });
  }

  getHubPost(id: string): Observable<any> {
    return this.http.get<any>(`${BASE}/hub/posts/${encodeURIComponent(id)}`);
  }

  createHubPost(body: { content?: string; images?: string[]; topic?: string; poll?: any; replyOption?: string; scheduledAt?: string }): Observable<any> {
    return this.http.post<any>(`${BASE}/hub/posts`, body);
  }

  deleteHubPost(id: string): Observable<any> {
    return this.http.delete<any>(`${BASE}/hub/posts/${encodeURIComponent(id)}`);
  }

  toggleHubLike(postId: string): Observable<{ liked: boolean; likeCount: number }> {
    return this.http.post<{ liked: boolean; likeCount: number }>(`${BASE}/hub/posts/${encodeURIComponent(postId)}/like`, {});
  }

  repostHub(postId: string): Observable<any> {
    return this.http.post<any>(`${BASE}/hub/posts/${encodeURIComponent(postId)}/repost`, {});
  }

  shareHub(postId: string, method: string = 'copy_link'): Observable<{ shareCount: number }> {
    return this.http.post<{ shareCount: number }>(`${BASE}/hub/posts/${encodeURIComponent(postId)}/share`, { method });
  }

  getHubComments(postId: string, sort: string = 'newest'): Observable<any[]> {
    return this.http.get<any[]>(`${BASE}/hub/posts/${encodeURIComponent(postId)}/comments`, { params: { sort } });
  }

  createHubComment(postId: string, body: { content: string; images?: string[]; parentComment?: string }): Observable<any> {
    return this.http.post<any>(`${BASE}/hub/posts/${encodeURIComponent(postId)}/comments`, body);
  }

  toggleHubCommentLike(commentId: string): Observable<{ liked: boolean; likeCount: number }> {
    return this.http.post<{ liked: boolean; likeCount: number }>(`${BASE}/hub/comments/${encodeURIComponent(commentId)}/like`, {});
  }

  deleteHubComment(commentId: string): Observable<any> {
    return this.http.delete<any>(`${BASE}/hub/comments/${encodeURIComponent(commentId)}`);
  }

  voteHubPoll(postId: string, optionIndex: number): Observable<{ poll: any }> {
    return this.http.post<{ poll: any }>(`${BASE}/hub/posts/${encodeURIComponent(postId)}/vote`, { optionIndex });
  }

  getHubTopics(): Observable<string[]> {
    return this.http.get<string[]>(`${BASE}/hub/topics`);
  }

  getHubTrending(limit: number = 5): Observable<any[]> {
    return this.http.get<any[]>(`${BASE}/hub/trending`, { params: { limit: String(limit) } });
  }

  uploadHubImages(files: File[]): Observable<{ urls: string[] }> {
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));
    return this.http.post<{ urls: string[] }>(`${BASE}/hub/upload`, fd);
  }

  // AuraHub user activity
  getHubUserPosts(userId: string, type: 'threads' | 'media' | 'reposts') {
    const params = new HttpParams().set('type', type);
    return this.http.get<{ success: boolean; items: any[] }>(
      `${BASE}/hub/user/${encodeURIComponent(userId)}/posts`,
      { params }
    );
  }

  getHubUserPending() {
    return this.http.get<{ success: boolean; items: any[] }>(`${BASE}/hub/user/me/pending`);
  }

  getHubUserReplies(userId: string) {
    return this.http.get<{ success: boolean; items: any[] }>(
      `${BASE}/hub/user/${encodeURIComponent(userId)}/replies`
    );
  }

  // ─── User notifications (client) ──────────────────────
  getNotifications(limit = 20, unreadOnly = false): Observable<{ items: UserNotification[]; unreadCount: number }> {
    let params = new HttpParams().set('limit', String(limit));
    if (unreadOnly) params = params.set('unreadOnly', 'true');
    return this.http.get<{ items: UserNotification[]; unreadCount: number }>(`${BASE}/notifications`, { params });
  }

  markNotificationRead(id: string): Observable<UserNotification> {
    return this.http.patch<UserNotification>(`${BASE}/notifications/${encodeURIComponent(id)}/read`, {});
  }

  markAllNotificationsRead(): Observable<{ success: boolean; modifiedCount: number }> {
    return this.http.patch<{ success: boolean; modifiedCount: number }>(`${BASE}/notifications/read-all`, {});
  }

  /** Danh sách FAQ (trang Hỗ trợ) */
  getFaqs(category?: string): Observable<FaqItem[]> {
    let url = `${BASE}/faqs`;
    if (category) url += `?category=${encodeURIComponent(category)}`;
    return this.http.get<FaqItem[]>(url);
  }
}

export interface FaqItem {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  order?: number;
}

export interface UserNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  metadata?: { orderNumber?: string };
  readAt?: string | null;
  createdAt?: string;
}
