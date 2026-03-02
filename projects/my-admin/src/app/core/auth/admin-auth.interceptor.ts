import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AdminAuthService } from './admin-auth.service';
import { environment } from '../../../environments/environment';

export const adminAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  const token = auth.getToken();
  const isApiRequest = req.url.startsWith(environment.apiUrl);

  if (token && isApiRequest) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(req).pipe(
    tap({
      error: (err) => {
        if (err.status === 401 && isApiRequest && !req.url.includes('/admin/auth/login')) {
          auth.logout();
          router.navigate(['/login']);
        }
      },
    })
  );
};
