import { ChangeDetectorRef, Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  AdminAccountsService,
  AvailablePhoneNumber,
  AvailableNumbersResponse,
  PhoneNumberSearchFilters,
} from '../../../../services/admin-accounts.service';

import { PhonePurchasesService } from '../../../../services/phone-purchases.service';

@Component({
  selector: 'app-add-phone-number-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-phone-number-dialog.html',
  styleUrl: './add-phone-number-dialog.scss',
})
export class AddPhoneNumberDialog implements OnInit {
  @Input() accountId: number | null = null;
  @Input() accountName = '';
  @Input() mode: 'ADMIN' | 'CLIENT' = 'ADMIN';

  @Output() closed = new EventEmitter<void>();

  areaCode = '645';
  loading = false;
  error = '';

  result: AvailableNumbersResponse | null = null;
  selectedNumber: AvailablePhoneNumber | null = null;

  searchMode: 'QUICK' | 'ADVANCED' = 'QUICK';

  // Advanced search
  advancedState = '';
  advancedCity = '';
  advancedAreaCode = '';
  includeAlternatives = false;

  readonly usStates = [
    ['AL', 'Alabama'],
    ['AK', 'Alaska'],
    ['AZ', 'Arizona'],
    ['AR', 'Arkansas'],
    ['CA', 'California'],
    ['CO', 'Colorado'],
    ['CT', 'Connecticut'],
    ['DE', 'Delaware'],
    ['FL', 'Florida'],
    ['GA', 'Georgia'],
    ['HI', 'Hawaii'],
    ['ID', 'Idaho'],
    ['IL', 'Illinois'],
    ['IN', 'Indiana'],
    ['IA', 'Iowa'],
    ['KS', 'Kansas'],
    ['KY', 'Kentucky'],
    ['LA', 'Louisiana'],
    ['ME', 'Maine'],
    ['MD', 'Maryland'],
    ['MA', 'Massachusetts'],
    ['MI', 'Michigan'],
    ['MN', 'Minnesota'],
    ['MS', 'Mississippi'],
    ['MO', 'Missouri'],
    ['MT', 'Montana'],
    ['NE', 'Nebraska'],
    ['NV', 'Nevada'],
    ['NH', 'New Hampshire'],
    ['NJ', 'New Jersey'],
    ['NM', 'New Mexico'],
    ['NY', 'New York'],
    ['NC', 'North Carolina'],
    ['ND', 'North Dakota'],
    ['OH', 'Ohio'],
    ['OK', 'Oklahoma'],
    ['OR', 'Oregon'],
    ['PA', 'Pennsylvania'],
    ['RI', 'Rhode Island'],
    ['SC', 'South Carolina'],
    ['SD', 'South Dakota'],
    ['TN', 'Tennessee'],
    ['TX', 'Texas'],
    ['UT', 'Utah'],
    ['VT', 'Vermont'],
    ['VA', 'Virginia'],
    ['WA', 'Washington'],
    ['WV', 'West Virginia'],
    ['WI', 'Wisconsin'],
    ['WY', 'Wyoming'],
    ['DC', 'District of Columbia'],
  ] as const;

  setSearchMode(mode: 'QUICK' | 'ADVANCED'): void {
    if (this.searchMode === mode) return;

    this.searchMode = mode;
    this.result = null;
    this.selectedNumber = null;
    this.error = '';
    this.cdr.detectChanges();
  }

  @Output() orderCreated = new EventEmitter<void>();

  reviewingOrder = false;
  creatingOrder = false;
  orderError = '';
  orderSuccess = '';

  private readonly purchasesApi = inject(PhonePurchasesService);

  get canCreateOrder(): boolean {
    return (
      this.mode === 'CLIENT' &&
      this.selectedNumber !== null &&
      this.selectedNumber.supportsVoice &&
      !this.loading &&
      !this.creatingOrder
    );
  }

  openOrderReview(): void {
    if (!this.canCreateOrder) return;

    this.orderError = '';
    this.orderSuccess = '';
    this.reviewingOrder = true;
  }

  closeOrderReview(): void {
    if (this.creatingOrder) return;
    this.reviewingOrder = false;
  }

  createOrder(): void {
    if (!this.canCreateOrder || !this.reviewingOrder || !this.selectedNumber) {
      return;
    }

    const phoneNumber = this.selectedNumber.phoneNumber;

    this.creatingOrder = true;
    this.orderError = '';

    this.purchasesApi
      .create(phoneNumber)
      .pipe(
        finalize(() => {
          this.creatingOrder = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.reviewingOrder = false;
          this.selectedNumber = null;
          this.result = null;

          this.orderCreated.emit();
          this.closed.emit();
        },
        error: (err: HttpErrorResponse) => {
          const message = err.error?.message;

          this.orderError = Array.isArray(message)
            ? message.join(', ')
            : typeof message === 'string'
              ? message
              : 'Unable to create purchase order.';

          this.cdr.detectChanges();
        },
      });
  }

  constructor(
    private readonly api: AdminAccountsService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.search();
  }

  search(): void {
    if (this.loading || (this.mode === 'ADMIN' && !this.accountId)) {
      return;
    }

    let filters: PhoneNumberSearchFilters;

    if (this.searchMode === 'QUICK') {
      filters = {
        areaCode: this.areaCode,
        bestEffort: true,
      };
    } else {
      filters = {
        state: this.advancedState,
        city: this.advancedCity.trim(),
        areaCode: this.advancedAreaCode.trim(),
        bestEffort: this.includeAlternatives,
      };

      if (!filters.state && !filters.city && !filters.areaCode) {
        this.error = 'Enter at least a state, city or area code.';
        this.cdr.detectChanges();
        return;
      }
    }

    this.loading = true;
    this.error = '';
    this.result = null;
    this.selectedNumber = null;

    this.cdr.detectChanges();

    const request$ =
      this.mode === 'CLIENT'
        ? this.api.searchMyAvailableNumbers(filters)
        : this.api.searchAvailableNumbers(this.accountId!, filters);

    request$
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response: AvailableNumbersResponse) => {
          this.result = response;
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          const message = err?.error?.message;

          this.error = Array.isArray(message)
            ? message.join(', ')
            : typeof message === 'string'
              ? message
              : 'Unable to search phone numbers.';

          this.cdr.detectChanges();
        },
      });
  }

  selectNumber(number: AvailablePhoneNumber): void {
    if (!number.supportsVoice) return;
    this.selectedNumber = number;
  }

  isSelected(number: AvailablePhoneNumber): boolean {
    return this.selectedNumber?.phoneNumber === number.phoneNumber;
  }

  formatNumber(number: string): string {
    const match = number.match(/^\+1(\d{3})(\d{3})(\d{4})$/);

    return match ? `(${match[1]}) ${match[2]}-${match[3]}` : number;
  }

  price(value?: string): string {
    if (value === undefined || value === '') {
      return 'Not available';
    }

    const amount = Number(value);

    return Number.isFinite(amount)
      ? amount.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
        })
      : 'Not available';
  }

  close(): void {
    this.closed.emit();
  }
}
