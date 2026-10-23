import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELED';

export type AccountType = 'BUSINESS' | 'PERSONAL';

export type AdminLockMode = 'NONE' | 'PURCHASES' | 'SERVICE' | 'FULL';

export interface AdminAccount {
  id: number;
  name: string;
  slug: string;
  accountType: AccountType;
  status: AccountStatus;

  adminLocked: boolean;
  adminLockMode: AdminLockMode;
  adminLockReason: string | null;

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
  accountType: AccountType;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
}

export interface CreatedAdminAccount {
  id: number;
  name: string;
  accountType: AccountType;
  slug: string;
  status: AccountStatus;
  owner: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
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
    accountType?: AccountType | 'ALL';
  }): Observable<AdminAccountsResponse> {
    let httpParams = new HttpParams().set('page', params.page).set('pageSize', params.pageSize);

    if (params.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    if (params.status && params.status !== 'ALL') {
      httpParams = httpParams.set('status', params.status);
    }

    if (params.accountType && params.accountType !== 'ALL') {
      httpParams = httpParams.set('accountType', params.accountType);
    }

    return this.http.get<AdminAccountsResponse>(this.apiUrl, { params: httpParams });
  }

  create(payload: CreateAdminAccountRequest): Observable<CreatedAdminAccount> {
    return this.http.post<CreatedAdminAccount>(this.apiUrl, payload);
  }

  lockAccount(
    accountId: number,
    mode: 'PURCHASES' | 'SERVICE' | 'FULL',
    reason: string,
  ): Observable<{
    accountId: number;
    locked: boolean;
    mode: string;
    reason: string;
  }> {
    return this.http.put<{
      accountId: number;
      locked: boolean;
      mode: string;
      reason: string;
    }>(`${this.apiUrl}/${accountId}/lock`, { mode, reason });
  }

  unlockAccount(
    accountId: number,
    reason: string,
  ): Observable<{
    accountId: number;
    locked: boolean;
    mode: string;
  }> {
    return this.http.put<{
      accountId: number;
      locked: boolean;
      mode: string;
    }>(`${this.apiUrl}/${accountId}/unlock`, { reason });
  }
}
