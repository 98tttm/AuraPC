import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe, NgIf } from '@angular/common';
import { ApiService, BlogPost, Product } from '../../core/services/api.service';

type BlogCategorySlug =
  | 'tin-tuc'
  | 'giai-tri-game'
  | 'tin-tuc-cong-nghe'
  | 'review-cong-nghe'
  | 'huong-dan-thu-thuat'
  | string;

const CATEGORY_LABELS: Record<string, string> = {
  'tin-tuc': 'Tin tức',
  'giai-tri-game': 'Giải Trí - Game',
  'tin-tuc-cong-nghe': 'Tin Tức Công Nghệ',
  'review-cong-nghe': 'Review Công Nghệ',
  'huong-dan-thu-thuat': 'Hướng dẫn - Thủ Thuật',
};

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [RouterLink, DecimalPipe, NgIf],
  template: `
    <section class="blog-page">
      <nav class="pl-breadcrumb">
        <a routerLink="/" [queryParams]="{}" queryParamsHandling="">Trang chủ</a>
        <span class="pl-breadcrumb__sep">/</span>
        <a routerLink="/blog" class="pl-breadcrumb__link">Tất cả bài viết</a>
        @if (selectedCategory() !== 'all') {
          <span class="pl-breadcrumb__sep">/</span>
          <span class="pl-breadcrumb__current">
            {{ getCategoryLabel(selectedCategory() || '') }}
          </span>
        }
      </nav>

      <div class="blog-container">
        @if (loading()) {
          <div class="loading">Đang tải...</div>
        } @else {
          <div class="layout">
            <!-- Sidebar -->
            <aside class="sidebar">
              <div class="sidebar-section">
                <h2 class="sidebar-title">Danh mục</h2>
                <ul class="category-list">
                  <li>
                    <button
                      type="button"
                      class="category-item"
                      [class.category-item--active]="selectedCategory() === 'all'"
                      (click)="setCategory('all')"
                    >
                      Tất cả bài viết
                    </button>
                  </li>
                  @for (cat of categoryOptions(); track cat.slug) {
                    <li>
                      <button
                        type="button"
                        class="category-item"
                        [class.category-item--active]="selectedCategory() === cat.slug"
                        (click)="setCategory(cat.slug)"
                      >
                        {{ cat.label }}
                      </button>
                    </li>
                  }
                </ul>
              </div>

              <div class="sidebar-section">
                <h2 class="sidebar-title">Bài viết mới nhất</h2>
                <ul class="latest-list">
                  @for (post of latestPosts(); track post._id) {
                    <li>
                      <a [routerLink]="['/blog', post.slug]" class="latest-item">
                        <div class="latest-thumb">
                          <img [src]="getCover(post)" [alt]="post.title" loading="lazy" />
                        </div>
                        <div class="latest-info">
                          <p class="latest-title">{{ post.title }}</p>
                          <p class="latest-date">
                            <span class="icon-calendar">📅</span>
                            {{ formatDate(post.publishedAt) }}
                          </p>
                        </div>
                      </a>
                    </li>
                  }
                </ul>
              </div>

              <div class="sidebar-section" *ngIf="featuredProducts().length">
                <h2 class="sidebar-title">Sản phẩm nổi bật</h2>
                <ul class="product-list">
                  @for (p of featuredProducts(); track p._id) {
                    <li>
                      <a [routerLink]="['/san-pham', p.slug]" class="product-item">
                        <div class="product-thumb">
                          <img [src]="productImageUrl(p)" [alt]="p.name" loading="lazy" />
                        </div>
                        <div class="product-info">
                          <p class="product-name">{{ p.name }}</p>
                          <p class="product-price">{{ productPrice(p) | number:'1.0-0' }}₫</p>
                        </div>
                      </a>
                    </li>
                  }
                </ul>
              </div>
            </aside>

            <!-- Main content -->
            <main class="main">
              <div class="main-header">
                <h1 class="page-title">Tất cả bài viết</h1>
                <p class="page-subtitle">
                  Cập nhật tin tức, hướng dẫn và mẹo hay mới nhất về laptop, PC và gaming.
                </p>
              </div>

              <div class="post-grid">
                @for (post of visiblePosts(); track post._id; let i = $index) {
                  <article
                    class="post-card"
                    [class.post-card--featured]="i === 0"
                  >
                    <a [routerLink]="['/blog', post.slug]" class="post-card__link">
                      <div class="post-thumb">
                        <img [src]="getCover(post)" [alt]="post.title" loading="lazy" />
                      </div>
                      <div class="post-body">
                        <div class="post-meta">
                          <span class="post-category">
                            {{ getCategoryLabel(post.category) }}
                          </span>
                          <span class="post-date">
                            {{ formatDate(post.publishedAt) }}
                          </span>
                        </div>
                        <h2 class="post-title">{{ post.title }}</h2>
                        @if (post.excerpt) {
                          <p class="post-excerpt">
                            {{ cleanExcerpt(post.excerpt) }}
                          </p>
                        }
                        <span class="post-more">Xem thêm ></span>
                      </div>
                    </a>
                  </article>
                }
              </div>
            </main>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .blog-page {
      padding: 2rem 0 4rem;
      background: #f5f5f7;
      min-height: 70vh;
    }
    .blog-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1.5rem;
      color: #111827;
    }

    /* Breadcrumb – copy lại thiết kế từ trang sản phẩm */
    .pl-breadcrumb {
      max-width: 1280px;
      margin: 0 auto 1rem;
      padding: 0 1.5rem;
      font-size: 0.9rem;
      color: #666666;
    }
    .pl-breadcrumb a {
      color: #333333;
      text-decoration: none;
    }
    .pl-breadcrumb a:hover {
      color: #ff6d2d;
    }
    .pl-breadcrumb__sep {
      margin: 0 0.35rem;
    }
    .pl-breadcrumb__current {
      color: #333333;
      font-weight: 500;
    }
    .loading {
      text-align: center;
      padding: 4rem 0;
      color: var(--text-secondary, #9ca3af);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
      gap: 2.5rem;
      align-items: flex-start;
    }
    @media (max-width: 992px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    /* Sidebar */
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }
    .sidebar-section {
      background: #ffffff;
      border-radius: 1rem;
      padding: 1.25rem 1.35rem;
      border: 1px solid rgba(209, 213, 219, 0.8);
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }
    .sidebar-title {
      font-size: 0.95rem;
      font-weight: 700;
      margin: 0 0 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #111827;
    }
    .category-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .category-item {
      width: 100%;
      text-align: left;
      border-radius: 999px;
      border: 1px solid #111827;
      background: #ffffff;
      color: #111827;
      padding: 0.4rem 0.8rem;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
    }
    .category-item:hover {
      background: #f3f4f6;
    }
    .category-item--active {
      background: #111827;
      color: #ffffff;
      font-weight: 600;
      box-shadow: 0 0 0 1px #111827;
    }

    .latest-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .latest-item {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr);
      gap: 0.6rem;
      text-decoration: none;
      color: inherit;
    }
    .latest-thumb {
      width: 72px;
      height: 48px;
      border-radius: 0.5rem;
      overflow: hidden;
      background: #020617;
    }
    .latest-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .latest-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.18rem;
    }
    .latest-title {
      font-size: 0.82rem;
      line-height: 1.35;
      color: #111827;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .latest-date {
      font-size: 0.75rem;
      color: #6b7280;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .icon-calendar {
      font-size: 0.8rem;
    }

    .product-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .product-item {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr);
      gap: 0.6rem;
      text-decoration: none;
      color: inherit;
    }
    .product-thumb {
      width: 72px;
      height: 56px;
      border-radius: 0.6rem;
      overflow: hidden;
      background: #e5e7eb;
    }
    .product-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .product-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.18rem;
    }
    .product-name {
      font-size: 0.82rem;
      color: #111827;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .product-price {
      font-size: 0.8rem;
      color: #dc2626;
      font-weight: 600;
    }

    .tag-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .tag-chip {
      border-radius: 999px;
      border: 1px solid #111827;
      padding: 0.22rem 0.7rem;
      font-size: 0.78rem;
      background: #ffffff;
      color: #111827;
      cursor: pointer;
      transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
    }
    .tag-chip:hover {
      background: #f3f4f6;
    }
    .tag-chip--active {
      background: #111827;
      border-color: #111827;
      color: #ffffff;
      font-weight: 600;
      box-shadow: 0 0 0 1px #111827;
    }

    /* Main column */
    .main-header {
      margin-bottom: 1.8rem;
    }
    .page-title {
      font-size: 1.7rem;
      font-weight: 700;
      margin: 0 0 0.4rem;
      letter-spacing: 0.04em;
    }
    .page-subtitle {
      margin: 0;
      font-size: 0.9rem;
      color: #6b7280;
    }
    .post-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1.5rem;
    }
    @media (max-width: 1200px) {
      .post-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 768px) {
      .post-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .post-card {
      background: #ffffff;
      border-radius: 1rem;
      overflow: hidden;
      border: 1px solid rgba(209, 213, 219, 0.9);
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
    }
    .post-card--featured {
      grid-column: span 2;
    }
    @media (max-width: 1200px) {
      .post-card--featured {
        grid-column: span 2;
      }
    }
    @media (max-width: 768px) {
      .post-card--featured {
        grid-column: span 1;
      }
    }
    .post-card__link {
      display: flex;
      flex-direction: column;
      height: 100%;
      color: inherit;
      text-decoration: none;
    }
    .post-thumb {
      position: relative;
      width: 100%;
      padding-top: 56%;
      overflow: hidden;
    }
    .post-thumb img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .post-body {
      padding: 1rem 1.1rem 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .post-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.8rem;
      color: #6b7280;
    }
    .post-category {
      padding: 0.16rem 0.7rem;
      border-radius: 999px;
      border: 1px solid rgba(209, 213, 219, 0.9);
      background: #f9fafb;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .post-title {
      font-size: 1.02rem;
      font-weight: 700;
      margin: 0;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      padding: 0.35rem 0.55rem;
      border-radius: 0.55rem;
      background: #000000;
      color: #ffffff;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.35);
    }
    .post-excerpt {
      margin: 0;
      font-size: 0.88rem;
      color: #4b5563;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .post-more {
      margin-top: 0.35rem;
      font-size: 0.82rem;
      color: #ff6d2d;
      font-weight: 600;
    }
    .post-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
      border-color: rgba(255, 109, 45, 0.9);
    }
  `]
})
export class BlogListComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  allBlogs = signal<BlogPost[]>([]);
  loading = signal(true);

  featuredProducts = signal<Product[]>([]);

  /** all | category slug */
  selectedCategory = signal<'all' | BlogCategorySlug>('all');
  selectedTag = signal<string | null>(null);

  private parseDate(input?: string): Date {
    if (!input) return new Date(0);
    // Hỗ trợ dd/MM/yyyy hoặc ISO
    const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const d = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const y = Number(m[3]);
      return new Date(y, mo, d);
    }
    const d = new Date(input);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  /** Danh sách bài viết mới nhất (5 bài) */
  latestPosts = computed(() =>
    [...this.allBlogs()].sort((a, b) => this.parseDate(b.publishedAt).getTime() - this.parseDate(a.publishedAt).getTime()).slice(0, 5),
  );

  /** Danh mục từ dữ liệu Blogs */
  categoryOptions = computed(() => {
    const seen = new Set<string>();
    const res: { slug: BlogCategorySlug; label: string }[] = [];
    for (const b of this.allBlogs()) {
      const slug = (b.category as BlogCategorySlug | undefined) || '';
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      res.push({ slug, label: this.getCategoryLabel(slug) });
    }
    return res;
  });

  tags = computed(() => this.categoryOptions().map(c => c.label));

  /** Post list theo bộ lọc danh mục + tag */
  visiblePosts = computed(() => {
    const all = [...this.allBlogs()].sort(
      (a, b) => this.parseDate(b.publishedAt).getTime() - this.parseDate(a.publishedAt).getTime(),
    );
    const cat = this.selectedCategory();
    const tag = this.selectedTag();
    let filtered = cat === 'all' ? all : all.filter(b => (b.category as BlogCategorySlug | undefined) === cat);
    if (tag) {
      filtered = filtered.filter(b => this.getCategoryLabel(b.category as BlogCategorySlug | undefined) === tag);
    }
    return filtered;
  });

  constructor() {
    this.loadBlogs();
    this.loadFeaturedProducts();

    // Đồng bộ selectedCategory với query param ?category=... (từ header dropdown Bản tin, v.v.)
    this.route.queryParamMap.subscribe((params) => {
      const raw = params.get('category') as BlogCategorySlug | null;
      const slug: 'all' | BlogCategorySlug = (raw && raw.length > 0 ? raw : 'all');
      this.selectedCategory.set(slug);
    });
  }

  private loadBlogs(): void {
    this.loading.set(true);
    this.api.getBlogs(1, 100).subscribe({
      next: (res) => {
        this.allBlogs.set(res.items || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadFeaturedProducts(): void {
    this.api.getFeaturedProducts(5).subscribe({
      next: (list) => this.featuredProducts.set(Array.isArray(list) ? list : []),
      error: () => {},
    });
  }

  setCategory(slug: 'all' | BlogCategorySlug): void {
    this.selectedCategory.set(slug);
    const qp = slug === 'all' ? { category: null } : { category: slug };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: qp,
      queryParamsHandling: 'merge',
    });
  }

  toggleTag(tag: string): void {
    this.selectedTag.update(current => (current === tag ? null : tag));
  }

  getCategoryLabel(slug?: string | null): string {
    if (!slug) return 'Khác';
    const key = String(slug);
    if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
    // Fallback: slug → Title Case
    const withSpaces = key.replace(/[-_]+/g, ' ');
    return withSpaces.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Ảnh bìa blog: chỉ dùng coverImage từ DB hoặc placeholder (đã bỏ lấy ảnh từ content để cấu hình lại). */
  getCover(post: BlogPost): string {
    const cover = post.coverImage?.trim();
    return cover || 'assets/c8c67b26bfbd0df3a88be06bec886fd8bd006e7d.png';
  }

  cleanExcerpt(excerpt?: string | null): string {
    if (!excerpt) return '';
    return excerpt.replace(/Trang chủ/gi, '').replace(/\s+/g, ' ').trim();
  }

  formatDate(value?: string): string {
    const d = this.parseDate(value);
    if (!d || isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  productImageUrl(p: Product): string {
    const img = p.images?.[0];
    const url = typeof img === 'string' ? img : (img as { url?: string })?.url;
    return url || 'assets/c8c67b26bfbd0df3a88be06bec886fd8bd006e7d.png';
  }

  productPrice(p: Product): number {
    return p.salePrice ?? p.price;
  }
}
