import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService, BlogPost } from '../../core/services/api.service';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <section class="blog-detail">
      <div class="container">
        @if (loading()) {
          <div class="loading">Đang tải...</div>
        } @else if (post()) {
          <article class="article">
            <a routerLink="/blog" class="back-link">← Quay lại danh sách</a>
            <header class="article__header">
              <span class="article__tag">BLOG</span>
              <h1 class="article__title">{{ post()!.title }}</h1>
              <div class="article__meta">
                <span class="article__author">{{ post()!.author || 'AuraPC' }}</span>
                <span class="article__date">{{ post()!.publishedAt | date:'dd/MM/yyyy' }}</span>
              </div>
            </header>
            @if (post()!.coverImage) {
              <div class="article__cover">
                <img [src]="post()!.coverImage" [alt]="post()!.title" />
              </div>
            }
            <div class="article__content" [innerHTML]="post()!.content"></div>
          </article>
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
    .blog-detail { padding: 2rem 0 4rem; min-height: 60vh; background: var(--bg-primary, #0a0a0f); }
    .container { max-width: 800px; margin: 0 auto; padding: 0 1rem; }
    .loading { text-align: center; padding: 4rem 0; color: var(--text-secondary, #888); }
    .not-found { text-align: center; padding: 4rem 0; }
    .not-found h2 { color: var(--text-primary, #fff); margin-bottom: 1.5rem; }
    .back-link { display: inline-block; color: var(--text-secondary, #aaa); text-decoration: none; margin-bottom: 2rem; transition: color 0.2s; }
    .back-link:hover { color: var(--accent, #a855f7); }
    .article__header { margin-bottom: 2rem; }
    .article__tag { display: inline-block; padding: 4px 10px; background: var(--accent, #a855f7); color: #fff; font-size: 0.75rem; font-weight: 600; border-radius: 4px; margin-bottom: 1rem; }
    .article__title { font-size: 2rem; color: var(--text-primary, #fff); line-height: 1.3; margin-bottom: 1rem; }
    .article__meta { display: flex; gap: 1.5rem; color: var(--text-secondary, #aaa); font-size: 0.9rem; }
    .article__cover { margin-bottom: 2rem; border-radius: 12px; overflow: hidden; }
    .article__cover img { width: 100%; height: auto; }
    .article__content { color: var(--text-primary, #ddd); line-height: 1.8; font-size: 1.05rem; }
    .article__content :deep(h2) { font-size: 1.5rem; margin: 2rem 0 1rem; color: var(--text-primary, #fff); }
    .article__content :deep(h3) { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; color: var(--text-primary, #fff); }
    .article__content :deep(p) { margin-bottom: 1rem; }
    .article__content :deep(img) { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5rem 0; }
    .article__content :deep(ul), .article__content :deep(ol) { margin: 1rem 0; padding-left: 1.5rem; }
    .article__content :deep(li) { margin-bottom: 0.5rem; }
    .article__content :deep(a) { color: var(--accent, #a855f7); text-decoration: underline; }
    .article__content :deep(blockquote) { border-left: 3px solid var(--accent, #a855f7); padding-left: 1rem; margin: 1.5rem 0; color: var(--text-secondary, #aaa); font-style: italic; }
    .btn { display: inline-block; padding: 0.875rem 1.5rem; border-radius: 6px; font-weight: 600; text-decoration: none; }
    .btn--primary { background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; }
  `]
})
export class BlogDetailComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  post = signal<BlogPost | null>(null);
  loading = signal(true);

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.api.getBlogBySlug(slug).subscribe({
        next: (post) => {
          this.post.set(post);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        }
      });
    } else {
      this.loading.set(false);
    }
  }
}
