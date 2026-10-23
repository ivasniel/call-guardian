import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ============================================================
// ACCOUNT TYPES
// ============================================================

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELED';

export type AccountType = 'BUSINESS' | 'PERSONAL';

export type AdminLockMode = 'NONE' | 'PURCHASES' | 'SERVICE' | 'FULL';

// ============================================================
// PHONE NUMBER SEARCH
// ============================================================

export interface AvailablePhoneNumber {
  phoneNumber: string;
  exactAreaCode: boolean;
  actualAreaCode: string;

  features: string[];

  supportsVoice: boolean;
  supportsSms: boolean;
  supportsMms: boolean;

  costInformation: {
    monthly_cost?: string;
    upfront_cost?: string;
    currency?: string;
  } | null;

  regionInformation: unknown[];
  reservable: boolean;
}

export interface PhoneNumberSearchFilters {
  areaCode?: string;
  state?: string;
  city?: string;
  bestEffort?: boolean;
}

export interface AvailableNumbersResponse {
  accountId: number;
  areaCode: string;
  countryCode: string;
  bestEffort: boolean;
  total: number;
  exactMatches: number;

  eligibility: {
    allowed: boolean;
    accountId: number;
    subscriptionId: number;
    source: 'PAID' | 'ADMIN_COURTESY';
    maxNumbers: number;
    currentNumbers: number;
    remainingNumbers: number;
    requiresRealPurchaseApproval: boolean;
  };

  numbers: AvailablePhoneNumber[];
}

// ============================================================
// ADMIN ACCOUNTS
// ============================================================

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

// ============================================================
// COURTESY PLANS
// ============================================================

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

// ============================================================
// ADMIN ACCOUNTS SERVICE
// ============================================================

@Injectable({
  providedIn: 'root',
})
export class AdminAccountsService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = '/admin/accounts';

  // ==========================================================
  // CLIENT MANAGEMENT
  // ==========================================================

  list(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    accountType?: AccountType | 'ALL';
  }): Observable<AdminAccountsResponse> {
    let httpParams = new HttpParams()
      .set('page', String(params.page))
      .set('pageSize', String(params.pageSize));

    if (params.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    if (params.status && params.status !== 'ALL') {
      httpParams = httpParams.set('status', params.status);
    }

    if (params.accountType && params.accountType !== 'ALL') {
      httpParams = httpParams.set('accountType', params.accountType);
    }

    return this.http.get<AdminAccountsResponse>(this.apiUrl, {
      params: httpParams,
    });
  }

  create(payload: CreateAdminAccountRequest): Observable<CreatedAdminAccount> {
    return this.http.post<CreatedAdminAccount>(this.apiUrl, payload);
  }

  // ==========================================================
  // ADMIN ACCOUNT LOCKS
  // ==========================================================

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
    }>(`${this.apiUrl}/${accountId}/lock`, {
      mode,
      reason,
    });
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
    }>(`${this.apiUrl}/${accountId}/unlock`, {
      reason,
    });
  }

  // ==========================================================
  // SUBSCRIPTIONS
  // ==========================================================

  getSubscription(accountId: number): Observable<AccountSubscriptionResponse> {
    return this.http.get<AccountSubscriptionResponse>(`${this.apiUrl}/${accountId}/subscription`);
  }

  // ==========================================================
  // COURTESY PLAN MANAGEMENT
  // ==========================================================

  grantCourtesy(accountId: number, input: CourtesyPlanInput): Observable<unknown> {
    return this.http.post<unknown>(`${this.apiUrl}/${accountId}/courtesy`, input);
  }

  extendCourtesy(
    accountId: number,
    additionalDays: number,
    reason: string,
  ): Observable<CourtesyActionResponse> {
    return this.http.put<CourtesyActionResponse>(`${this.apiUrl}/${accountId}/courtesy/extend`, {
      additionalDays,
      reason,
    });
  }

  updateCourtesyLimits(
    accountId: number,
    input: Omit<CourtesyPlanInput, 'durationDays'>,
  ): Observable<CourtesyActionResponse> {
    return this.http.put<CourtesyActionResponse>(
      `${this.apiUrl}/${accountId}/courtesy/limits`,
      input,
    );
  }

  revokeCourtesy(accountId: number, reason: string): Observable<CourtesyActionResponse> {
    return this.http.put<CourtesyActionResponse>(`${this.apiUrl}/${accountId}/courtesy/revoke`, {
      reason,
    });
  }

  // ==========================================================
  // TELNYX PHONE NUMBER SEARCH
  // QUICK SEARCH + ADVANCED SEARCH
  // ==========================================================

  searchAvailableNumbers(
    accountId: number,
    filters: PhoneNumberSearchFilters,
  ): Observable<AvailableNumbersResponse> {
    let params = new HttpParams();

    // Quick or advanced area code search.
    if (filters.areaCode?.trim()) {
      params = params.set('areaCode', filters.areaCode.trim());
    }

    // Advanced search by US state.
    if (filters.state?.trim()) {
      params = params.set('state', filters.state.trim().toUpperCase());
    }

    // Advanced search by city/locality.
    if (filters.city?.trim()) {
      params = params.set('city', filters.city.trim());
    }

    // Strict results or Telnyx alternatives.
    params = params.set('bestEffort', String(filters.bestEffort ?? false));

    return this.http.get<AvailableNumbersResponse>(
      `${this.apiUrl}/${accountId}/available-numbers`,
      {
        params,
      },
    );
  }

  private buildNumberSearchParams(filters: PhoneNumberSearchFilters): HttpParams {
    let params = new HttpParams();

    if (filters.areaCode?.trim()) {
      params = params.set('areaCode', filters.areaCode.trim());
    }

    if (filters.state?.trim()) {
      params = params.set('state', filters.state.trim().toUpperCase());
    }

    if (filters.city?.trim()) {
      params = params.set('city', filters.city.trim());
    }

    params = params.set('bestEffort', String(filters.bestEffort ?? false));

    return params;
  }

searchMyAvailableNumbers(
  filters: PhoneNumberSearchFilters,
): Observable<AvailableNumbersResponse> {
  return this.http.get<AvailableNumbersResponse>(
    '/account/available-numbers',
    {
      params: this.buildNumberSearchParams(filters),
    },
  );
}

}
