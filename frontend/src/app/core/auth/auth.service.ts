
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenKey = 'cg_access_token';

  login(email: string, password: string) {
    return this.http.post<LoginResponse>('/auth/login', {
      email,
      password,
    }).pipe(
      tap(response => {
        sessionStorage.setItem(
          this.tokenKey,
          response.accessToken
        );
      })
    );
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getProfile() {
    return this.http.get<AuthUser>('/auth/me');
  }

  logout(): void {
    sessionStorage.removeItem(this.tokenKey);
    void this.router.navigateByUrl('/login');
  }
}
