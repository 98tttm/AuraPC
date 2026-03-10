import { Component, OnInit, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AdminApiService, BlogPost } from '../../core/admin-api.service';

@Component({
  selector: 'app-blog-detail-admin',
  standalone: true,
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './blog-detail-admin.component.html',
  styleUrl: './blog-detail-admin.component.css',
})
export class BlogDetailAdminComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(AdminApiService);

  blog = signal<BlogPost | null>(null);
  loading = signal(true);
  error = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api.getBlog(id).subscribe({
        next: (b) => {
          this.blog.set(b);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Không tìm thấy bài viết');
          this.loading.set(false);
        },
      });
    }
  }
}
