
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';

interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ACCOUNT_ADMIN' | 'ACCOUNT_USER';
  accountId: number | null;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  email = '';
  password = '';
  loading = false;
  error = '';
  showPassword = false;

  submit(): void {
    if (this.loading || !this.email.trim() || !this.password) {
      return;
    }

    this.loading = true;
    this.error = '';

    this.auth.login(this.email.trim(), this.password)
      .pipe(
        switchMap(() => this.http.get<CurrentUser>('/auth/me')),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (user) => {
          if (user.role === 'SUPER_ADMIN') {
            void this.router.navigateByUrl('/admin/dashboard');
          } else {
            void this.router.navigateByUrl('/dashboard');
          }
        },
        error: (err) => {
          if (err.status === 401) {
            this.error = 'Invalid email or password. Please try again.';
          } else {
            this.error = 'Unable to load your account. Please try again.';
          }
        },
      });
  }
}
