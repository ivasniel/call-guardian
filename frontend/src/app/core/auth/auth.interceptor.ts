
import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  // No enviar JWT al endpoint de login ni a servidores externos.
  const protectedRequest =
    request.url.startsWith('/') &&
    !request.url.startsWith('/auth/login');

  const outgoing =
    token && protectedRequest
      ? request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        })
      : request;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        protectedRequest
      ) {
        auth.logout();
      }

      return throwError(() => error);
    })
  );
};
