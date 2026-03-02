import { Component, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AdminApiService } from '../../core/admin-api.service';

@Component({
  selector: 'app-users-list-admin',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users-list-admin.component.html',
  styleUrl: './users-list-admin.component.css',
})
export class UsersListAdminComponent implements OnInit {
  users = signal<any[]>([]);
  total = signal(0);
  loading = signal(true);
  page = 1;
  limit = 20;
  searchQuery = '';

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.api.getUsers({ page: this.page, limit: this.limit, search: this.searchQuery }).subscribe({
      next: (res) => {
        this.users.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(): void {
    this.page = 1;
    this.loadUsers();
  }

  goToPage(p: number): void {
    this.page = p;
    this.loadUsers();
  }

  get totalPages(): number {
    return Math.ceil(this.total() / this.limit);
  }

  getUserName(user: any): string {
    return user.profile?.fullName || user.username || user.phoneNumber;
  }

  getInitial(user: any): string {
    const name = this.getUserName(user);
    return name.charAt(0).toUpperCase();
  }
}
