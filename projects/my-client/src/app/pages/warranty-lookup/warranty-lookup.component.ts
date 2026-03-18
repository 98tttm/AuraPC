import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import type { WarrantyLookupResult } from '../../core/services/api.service';

@Component({
  selector: 'app-warranty-lookup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './warranty-lookup.component.html',
  styleUrl: './warranty-lookup.component.css',
})
export class WarrantyLookupComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  query = signal('');
  result = signal<WarrantyLookupResult | null>(null);
  error = signal<string | null>(null);
  loading = signal(false);

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q && q.trim()) {
      this.query.set(q.trim());
      this.lookup();
    }
  }

  lookup(): void {
    const q = this.query().trim();
    if (!q) return;
    this.error.set(null);
    this.result.set(null);
    this.loading.set(true);
    this.api.lookupWarranty(q).subscribe({
      next: (data) => {
        this.result.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || err.message || 'Không tìm thấy thông tin bảo hành');
        this.result.set(null);
        this.loading.set(false);
      },
    });
  }

  formatDate(s: string | null | undefined): string {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      valid: 'Còn bảo hành',
      expired: 'Hết bảo hành',
      unknown: 'Không xác định',
    };
    return map[status] || status;
  }
}
