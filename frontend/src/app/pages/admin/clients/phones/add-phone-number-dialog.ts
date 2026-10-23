import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
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

@Component({
  selector: 'app-add-phone-number-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-phone-number-dialog.html',
  styleUrl: './add-phone-number-dialog.scss',
})
export class AddPhoneNumberDialog implements OnInit {
  @Input({ required: true }) accountId!: number;
  @Input() accountName = '';

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

  constructor(
    private readonly api: AdminAccountsService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.search();
  }

  search(): void {
    if (this.loading || !this.accountId) return;

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

    this.api
      .searchAvailableNumbers(this.accountId, filters)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response: AvailableNumbersResponse) => {
          this.result = response;
        },
        error: (err: HttpErrorResponse) => {
          const message = err?.error?.message;

          this.error = Array.isArray(message)
            ? message.join(', ')
            : message || 'Unable to search phone numbers.';
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
