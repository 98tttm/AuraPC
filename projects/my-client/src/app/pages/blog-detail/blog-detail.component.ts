import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ApiService, BlogPost, Product } from '../../core/services/api.service';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: `
    <section class="blog-detail">
      <nav class="pl-breadcrumb">
        <a routerLink="/" [queryParams]="{}" queryParamsHandling="">Trang chủ</a>
        <span class="pl-breadcrumb__sep">/</span>
        <a routerLink="/blog" class="pl-breadcrumb__link">Tất cả bài viết</a>
        @if (post()) {
          <span class="pl-breadcrumb__sep">/</span>
          <span class="pl-breadcrumb__current">{{ post()!.title }}</span>
        }
      </nav>

      <div class="blog-detail__container">
        @if (loading()) {
          <div class="loading">Đang tải...</div>
        } @else if (post()) {
          <div class="detail-layout">
            <!-- Sidebar giống Bản tin -->
            <aside class="sidebar">
              <div class="sidebar-section">
                <h2 class="sidebar-title">Danh mục</h2>
                <ul class="category-list">
                  @for (cat of categoryLinks; track cat.slug) {
                    <li>
                      <a
                        [routerLink]="['/blog']"
                        [queryParams]="{ category: cat.slug }"
                        class="category-link"
                      >
                        {{ cat.label }}
                      </a>
                    </li>
                  }
                </ul>
              </div>

              @if (latestPosts().length) {
                <div class="sidebar-section">
                  <h2 class="sidebar-title">Bài viết mới nhất</h2>
                  <ul class="latest-list">
                    @for (b of latestPosts(); track b._id) {
                      <li>
                        <a [routerLink]="['/blog', b.slug]" class="latest-item">
                          <div class="latest-thumb">
                            <img [src]="getCover(b)" [alt]="b.title" loading="lazy" />
                          </div>
                          <div class="latest-info">
                            <p class="latest-title">{{ b.title }}</p>
                            <p class="latest-date">
                              {{ b.publishedAt | date:'dd/MM/yyyy' }}
                            </p>
                          </div>
                        </a>
                      </li>
                    }
                  </ul>
                </div>
              }

              @if (featuredProducts().length) {
                <div class="sidebar-section">
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
              }
            </aside>

            <!-- Nội dung chính -->
            <main class="detail-main">
              <article class="article">
                <header class="article__header">
                  <span class="article__tag">BẢN TIN</span>
                  <h1 class="article__title">{{ post()!.title }}</h1>
                  <div class="article__meta">
                    <span class="article__author">{{ post()!.author || 'AuraPC' }}</span>
                    <span class="article__date">{{ post()!.publishedAt | date:'dd/MM/yyyy' }}</span>
                  </div>
                </header>

                @if (coverUrl()) {
                  <div class="article__cover">
                    <img [src]="coverUrl()!" [alt]="post()!.title" />
                  </div>
                }

                <div class="article__content" [innerHTML]="post()!.content"></div>

                <a routerLink="/blog" class="back-link">← Quay lại tất cả bài viết</a>
              </article>
            </main>
          </div>
        } @else {
          <div class="not-found">
            <h2>Không tìm thấy bài viết</h2>
            <a routerLink="/blog" class="btn btn--primary">Xem tất cả bài viết</a>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .blog-detail {
      padding: 2rem 0 4rem;
      min-height: 60vh;
      background: #f5f5f7;
    }
    .blog-detail__container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    /* Breadcrumb giống trang sản phẩm */
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

    .blog-breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.82rem;
      color: #6b7280;
      margin: 0.75rem 0 1.75rem;
    }
    .blog-breadcrumb a {
      color: #4b5563;
      text-decoration: none;
    }
    .blog-breadcrumb a:hover {
      text-decoration: underline;
    }
    .blog-breadcrumb__sep {
      color: #9ca3af;
    }
    .blog-breadcrumb__current {
      color: #111827;
      font-weight: 500;
    }
    .loading {
      text-align: center;
      padding: 4rem 0;
      color: #6b7280;
    }
    .not-found {
      text-align: center;
      padding: 4rem 0;
    }
    .not-found h2 {
      color: #111827;
      margin-bottom: 1.5rem;
    }
    .detail-layout {
      display: grid;
      grid-template-columns: minmax(0, 280px) minmax(0, 1fr);
      gap: 2.5rem;
      align-items: flex-start;
    }
    @media (max-width: 960px) {
      .detail-layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    /* Sidebar tái sử dụng style từ trang Bản tin */
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
    .category-link {
      display: block;
      padding: 0.4rem 0.2rem;
      font-size: 0.9rem;
      color: #111827;
      text-decoration: none;
    }
    .category-link:hover {
      text-decoration: underline;
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
      background: #e5e7eb;
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

    .detail-main {
      min-width: 0;
    }

    .article {
      background: #ffffff;
      border-radius: 1.25rem;
      padding: 2rem 2.25rem 2.5rem;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
      border: 1px solid rgba(209, 213, 219, 0.9);
    }
    .article__header {
      margin-bottom: 1.75rem;
    }
    .article__tag {
      display: inline-block;
      padding: 4px 12px;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 999px;
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .article__title {
      font-size: 2rem;
      color: #111827;
      line-height: 1.3;
      margin-bottom: 0.75rem;
    }
    .article__meta {
      display: flex;
      gap: 1.5rem;
      color: #6b7280;
      font-size: 0.9rem;
    }
    .article__cover {
      margin-bottom: 1.75rem;
      border-radius: 1rem;
      overflow: hidden;
    }
    .article__cover img {
      width: 100%;
      height: auto;
      display: block;
    }
    .article__content {
      color: #111827;
      line-height: 1.75;
      font-size: 1rem;
    }
    .article__content :deep(h2) {
      font-size: 1.5rem;
      margin: 2rem 0 1rem;
      color: #111827;
    }
    .article__content :deep(h3) {
      font-size: 1.25rem;
      margin: 1.5rem 0 0.75rem;
      color: #111827;
    }
    .article__content :deep(p) {
      margin-bottom: 1rem;
    }
    .article__content :deep(img) {
      max-width: 100%;
      height: auto;
      border-radius: 0.75rem;
      margin: 1.5rem 0;
    }
    .article__content :deep(ul),
    .article__content :deep(ol) {
      margin: 1rem 0;
      padding-left: 1.5rem;
    }
    .article__content :deep(li) {
      margin-bottom: 0.5rem;
    }
    .article__content :deep(a) {
      color: #2563eb;
      text-decoration: underline;
    }
    .article__content :deep(blockquote) {
      border-left: 3px solid #2563eb;
      padding-left: 1rem;
      margin: 1.5rem 0;
      color: #6b7280;
      font-style: italic;
    }
    .back-link {
      display: inline-block;
      margin-top: 2rem;
      font-size: 0.9rem;
      color: #2563eb;
      text-decoration: none;
    }
    .back-link:hover {
      text-decoration: underline;
    }
    .btn {
      display: inline-block;
      padding: 0.875rem 1.5rem;
      border-radius: 6px;
      font-weight: 600;
      text-decoration: none;
    }
    .btn--primary {
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: #ffffff;
    }
  `]
})
export class BlogDetailComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  post = signal<BlogPost | null>(null);
  loading = signal(true);
  latestPosts = signal<BlogPost[]>([]);
  featuredProducts = signal<Product[]>([]);

  categoryLinks = [
    { slug: 'tin-tuc', label: 'Tin tức' },
    { slug: 'giai-tri-game', label: 'Giải Trí - Game' },
    { slug: 'tin-tuc-cong-nghe', label: 'Tin Tức Công Nghệ' },
    { slug: 'review-cong-nghe', label: 'Review Công Nghệ' },
    { slug: 'huong-dan-thu-thuat', label: 'Hướng dẫn - Thủ Thuật' },
  ];

  coverUrl = computed(() => {
    const p = this.post();
    return p ? this.getCover(p) : null;
  });

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.api.getBlogBySlug(slug).subscribe({
        next: (post) => {
          const normalizedContent = this.sanitizeContent(post.content);
          const normalizedPost: BlogPost = {
            ...post,
            content: normalizedContent ?? post.content,
          };
          this.post.set(normalizedPost);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        }
      });
    } else {
      this.loading.set(false);
    }

    // Sidebar: bài viết mới nhất
    this.api.getBlogs(1, 5).subscribe({
      next: (res) => this.latestPosts.set(res.items || []),
      error: () => {},
    });

    // Sidebar: sản phẩm nổi bật
    this.api.getFeaturedProducts(4).subscribe({
      next: (list) => this.featuredProducts.set(Array.isArray(list) ? list : []),
      error: () => {},
    });
  }

  /** Ảnh bìa bài viết: chỉ dùng coverImage từ DB hoặc placeholder (đã bỏ lấy ảnh từ content để cấu hình lại). */
  getCover(post: BlogPost): string {
    const cover = post.coverImage?.trim();
    return cover || 'assets/c8c67b26bfbd0df3a88be06bec886fd8bd006e7d.png';
  }

  /** Loại bỏ breadcrumb HTML của Xgear ở đầu nội dung để tránh trùng lặp. */
  private sanitizeContent(html?: string | null): string | null {
    if (!html) return html ?? null;
    // Thử dùng DOMParser để xoá chính xác các khối sidebar khỏi content
    if (typeof document !== 'undefined') {
      const container = document.createElement('div');
      container.innerHTML = html;
      const selectors = [
        '.breadcrumb-shop',
        '.sidebar-blog',
        '.sidebarblog-title',
        '.list-news-latest',
        '#blogtag',
        'aside.sidebar-blog',
      ];
      selectors.forEach(sel => {
        container.querySelectorAll(sel).forEach(el => el.remove());
      });
      return container.innerHTML;
    }

    // Fallback bằng regex (trường hợp không có DOM)
    let cleaned = html;
    cleaned = cleaned.replace(/<div class="breadcrumb-shop"[\s\S]*?<\/div>/i, '');
    cleaned = cleaned.replace(/<div class="sidebar-blog"[\s\S]*?<\/div>\s*/gi, '');
    cleaned = cleaned.replace(/<\/aside>/gi, '');
    return cleaned;
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
