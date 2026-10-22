
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELED';

export interface AdminAccount {
  id: number;
  name: string;
  slug: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  totalUsers: number;
  totalNumbers: number;
  totalCalls: number;
}

export interface AdminAccountsResponse {
  items: AdminAccount[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CreateAdminAccountRequest {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAccountsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/admin/accounts';

  list(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
  }): Observable<AdminAccountsResponse> {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('pageSize', params.pageSize);

    if (params.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    if (params.status && params.status !== 'ALL') {
      httpParams = httpParams.set('status', params.status);
    }

    return this.http.get<AdminAccountsResponse>(
      this.apiUrl,
      { params: httpParams },
    );
  }

  create(
    payload: CreateAdminAccountRequest,
  ): Observable<AdminAccount> {
    return this.http.post<AdminAccount>(this.apiUrl, payload);
  }
}
