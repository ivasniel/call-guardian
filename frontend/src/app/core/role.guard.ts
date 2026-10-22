
import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';

interface CurrentUser {
  id: number;
  role: 'SUPER_ADMIN' | 'ACCOUNT_ADMIN' | 'ACCOUNT_USER';
  active?: boolean | number;
}

function checkRole(adminRequired: boolean): ReturnType<CanActivateFn> {
  const http = inject(HttpClient);
  const router = inject(Router);

  return http.get<CurrentUser>('/auth/me').pipe(
    map((user) => {
      const isSuperAdmin = user.role === 'SUPER_ADMIN';
      const active = user.active === undefined || Boolean(user.active);

      if (!active) {
        return router.createUrlTree(['/login']);
      }

      if (adminRequired && !isSuperAdmin) {
        return router.createUrlTree(['/dashboard']);
      }

      if (!adminRequired && isSuperAdmin) {
        return router.createUrlTree(['/admin/dashboard']);
      }

      return true;
    }),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
}

export const superAdminGuard: CanActivateFn = () =>
  checkRole(true);

export const customerGuard: CanActivateFn = () =>
  checkRole(false);
