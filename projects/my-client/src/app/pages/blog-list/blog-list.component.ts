import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService, BlogPost } from '../../core/services/api.service';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <section class="blog-page">
      <div class="container">
        <h1 class="page-title">Tin tức & Hướng dẫn</h1>
        
        @if (loading()) {
          <div class="loading">Đang tải...</div>
        } @else {
          <div class="blog-grid">
            @for (post of blogs(); track post._id) {
              <a [routerLink]="['/blog', post.slug]" class="blog-card">
                <div class="blog-card__image">
                  <img [src]="post.coverImage || 'assets/placeholder.jpg'" [alt]="post.title" />
                </div>
                <div class="blog-card__content">
                  <span class="blog-card__tag">BLOG</span>
                  <h2 class="blog-card__title">{{ post.title }}</h2>
                  @if (post.excerpt) {
                    <p class="blog-card__excerpt">{{ post.excerpt }}</p>
                  }
                  <span class="blog-card__date">{{ post.publishedAt | date:'dd/MM/yyyy' }}</span>
                </div>
              </a>
            }
          </div>
          
          @if (hasMore()) {
            <div class="load-more">
              <button class="btn btn--outline" (click)="loadMore()" [disabled]="loadingMore()">
                {{ loadingMore() ? 'Đang tải...' : 'Xem thêm' }}
              </button>
            </div>
          }
        }
      </div>
    </section>
  `,
  styles: [`
    .blog-page { padding: 5.5rem 0 4rem; min-height: 60vh; background: var(--bg-primary, #0a0a0f); }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
    .page-title { font-size: 2rem; margin-bottom: 2rem; color: var(--text-primary, #fff); }
    .loading { text-align: center; padding: 4rem 0; color: var(--text-secondary, #888); }
    .blog-grid { display: grid; gap: 2rem; }
    @media (min-width: 640px) { .blog-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 1024px) { .blog-grid { grid-template-columns: repeat(3, 1fr); } }
    .blog-card { display: block; background: var(--bg-secondary, #1a1a25); border-radius: 12px; overflow: hidden; text-decoration: none; transition: transform 0.3s, box-shadow 0.3s; }
    .blog-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.3); }
    .blog-card__image { aspect-ratio: 16/10; overflow: hidden; }
    .blog-card__image img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
    .blog-card:hover .blog-card__image img { transform: scale(1.05); }
    .blog-card__content { padding: 1.25rem; }
    .blog-card__tag { display: inline-block; padding: 4px 8px; background: var(--accent, #a855f7); color: #fff; font-size: 0.7rem; font-weight: 600; border-radius: 4px; margin-bottom: 0.75rem; }
    .blog-card__title { font-size: 1.1rem; color: var(--text-primary, #fff); margin-bottom: 0.5rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .blog-card__excerpt { font-size: 0.9rem; color: var(--text-secondary, #aaa); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 0.5rem; }
    .blog-card__date { font-size: 0.8rem; color: var(--text-muted, #666); }
    .load-more { text-align: center; margin-top: 2rem; }
    .btn { display: inline-block; padding: 0.875rem 2rem; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn--outline { background: transparent; border: 1px solid var(--border, #333); color: var(--text-primary, #fff); }
    .btn--outline:hover:not(:disabled) { border-color: var(--accent, #a855f7); color: var(--accent, #a855f7); }
    .btn--outline:disabled { opacity: 0.6; cursor: not-allowed; }
  `]
})
export class BlogListComponent {
  private api = inject(ApiService);

  blogs = signal<BlogPost[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(true);
  loadingMore = signal(false);

  hasMore = () => this.blogs().length < this.total();

  constructor() {
    this.loadBlogs(true);
  }

  loadBlogs(reset: boolean) {
    if (reset) {
      this.page.set(1);
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }

    this.api.getBlogs(this.page(), 12).subscribe({
      next: (res) => {
        if (reset) {
          this.blogs.set(res.items);
        } else {
          this.blogs.update(list => [...list, ...res.items]);
        }
        this.total.set(res.total);
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    });
  }

  loadMore() {
    this.page.update(p => p + 1);
    this.loadBlogs(false);
  }
}
