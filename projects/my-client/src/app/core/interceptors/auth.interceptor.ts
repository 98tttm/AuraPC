import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * HTTP Interceptor: tự động gắn Authorization: Bearer <token>
 * vào mọi request tới API server (bỏ qua external URLs).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const token = auth.getToken();

    // Chỉ gắn token cho request tới API server
    const isApiRequest = req.url.startsWith(environment.apiUrl) ||
        req.url.startsWith(environment.apiUrl.replace('/api', ''));

    if (token && isApiRequest) {
        const cloned = req.clone({
            setHeaders: { Authorization: `Bearer ${token}` },
        });
        return next(cloned);
    }

    return next(req);
};
