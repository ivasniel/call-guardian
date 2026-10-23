import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type PhonePurchaseStatus =
  | 'PENDING_PAYMENT'
  | 'READY'
  | 'PURCHASING'
  | 'PURCHASED'
  | 'PROVISIONING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RECONCILIATION_REQUIRED'
  | 'CANCELED';

export interface CreatePhonePurchaseResponse {
  id: number;
  orderUuid: string;
  accountId: number;
  subscriptionId: number;
  phoneNumber: string;
  upfrontCost: string;
  monthlyCost: string;
  currency: string;
  status: 'PENDING_PAYMENT';
  message: string;
}

export interface PhonePurchaseOrder {
  id: number;
  orderUuid: string;
  accountId: number;
  subscriptionId: number;
  phoneNumber: string;
  countryCode: string;
  upfrontCost: string;
  monthlyCost: string;
  currency: string;
  fundingSource: string | null;
  fundingStatus: 'PENDING' | 'VERIFIED';
  status: PhonePurchaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CancelPhonePurchaseResponse {
  success: boolean;
  alreadyCanceled: boolean;
  orderId: number;
  accountId: number;
  phoneNumber?: string;
  status: 'CANCELED';
  slotReleased?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PhonePurchasesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/account/phone-purchases';

  list(): Observable<PhonePurchaseOrder[]> {
    return this.http.get<PhonePurchaseOrder[]>(this.apiUrl);
  }

  cancel(orderId: number): Observable<CancelPhonePurchaseResponse> {
    return this.http.post<CancelPhonePurchaseResponse>(`${this.apiUrl}/${orderId}/cancel`, {});
  }
  create(phoneNumber: string): Observable<CreatePhonePurchaseResponse> {
    return this.http.post<CreatePhonePurchaseResponse>(this.apiUrl, { phoneNumber });
  }
}
