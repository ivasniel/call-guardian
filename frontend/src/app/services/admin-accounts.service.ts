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

export interface CourtesyPlanInput {
  durationDays: number;
  maxUsers: number;
  maxNumbers: number;
  includedCalls: number;
  includedMinutes: number;
  allowAdditionalNumbers: boolean;
  reason: string;
}

export interface AccountSubscription {
  id: number;
  account_id: number;
  plan_id: number;
  source: 'PAID' | 'ADMIN_COURTESY';
  status: 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELED';
  starts_at: string;
  ends_at: string;
  max_users: number;
  max_numbers: number;
  included_calls: number;
  included_minutes: number;
  allow_additional_numbers: number | boolean;
  granted_by: number | null;
  grant_reason: string | null;
  plan_code: string;
  plan_name: string;
  account_name: string;
  currentlyActive: boolean;
}

export interface AccountSubscriptionResponse {
  accountId: number;
  subscription: AccountSubscription | null;
}

export interface CourtesyActionResponse {
  success: boolean;
  action: 'EXTEND' | 'UPDATE_LIMITS' | 'REVOKE';
  accountId: number;
  subscription: AccountSubscription;
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

  getSubscription(accountId: number) {
    return this.http.get<AccountSubscriptionResponse>(`/admin/accounts/${accountId}/subscription`);
  }

  grantCourtesy(accountId: number, input: CourtesyPlanInput) {
    return this.http.post(`/admin/accounts/${accountId}/courtesy`, input);
  }

  extendCourtesy(accountId: number, additionalDays: number, reason: string) {
    return this.http.put<CourtesyActionResponse>(`/admin/accounts/${accountId}/courtesy/extend`, {
      additionalDays,
      reason,
    });
  }

  updateCourtesyLimits(accountId: number, input: Omit<CourtesyPlanInput, 'durationDays'>) {
    return this.http.put<CourtesyActionResponse>(
      `/admin/accounts/${accountId}/courtesy/limits`,
      input,
    );
  }

  revokeCourtesy(accountId: number, reason: string) {
    return this.http.put<CourtesyActionResponse>(`/admin/accounts/${accountId}/courtesy/revoke`, {
      reason,
    });
  }
}
