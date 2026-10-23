import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';

import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import {
  PhonePurchaseOrder,
  PhonePurchasesService,
  PhonePurchaseStatus,
} from '../../../services/phone-purchases.service';

@Component({
  selector: 'app-phone-purchase-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './phone-purchase-history.html',
  styleUrl: './phone-purchase-history.scss',
})
export class PhonePurchaseHistory implements OnInit {
  private readonly api = inject(PhonePurchasesService);
  private readonly cdr = inject(ChangeDetectorRef);

  orders: PhonePurchaseOrder[] = [];

  loading = false;
  error = '';
  success = '';

  cancelingOrderId: number | null = null;
  confirmingOrderId: number | null = null;

  // =====================================================
  // CLIENT-SIDE PAGINATION
  // =====================================================

  currentPage = 1;
  readonly pageSize = 10;

  get totalItems(): number {
    return this.orders.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get paginatedOrders(): PhonePurchaseOrder[] {
    const start = (this.currentPage - 1) * this.pageSize;

    return this.orders.slice(start, start + this.pageSize);
  }

  get showingFrom(): number {
    if (this.totalItems === 0) return 0;

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get showingTo(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (this.loading) return;

    this.loading = true;
    this.error = '';

    this.api
      .list()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (orders: PhonePurchaseOrder[]) => {
          this.orders = orders;

          // Preserve current page unless it no longer exists.
          this.currentPage = Math.min(this.currentPage, this.totalPages);

          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.errorMessage(err, 'Unable to load purchase history.');
        },
      });
  }

  canCancel(order: PhonePurchaseOrder): boolean {
    return order.status === 'PENDING_PAYMENT' && order.fundingStatus === 'PENDING';
  }

  askCancel(order: PhonePurchaseOrder): void {
    if (!this.canCancel(order)) return;

    this.confirmingOrderId = order.id;
    this.error = '';
    this.success = '';
  }

  dismissCancel(): void {
    this.confirmingOrderId = null;
  }

  confirmCancel(order: PhonePurchaseOrder): void {
    if (
      !this.canCancel(order) ||
      this.cancelingOrderId !== null ||
      this.confirmingOrderId !== order.id
    ) {
      return;
    }

    this.cancelingOrderId = order.id;
    this.confirmingOrderId = null;

    this.error = '';
    this.success = '';

    this.api
      .cancel(order.id)
      .pipe(
        finalize(() => {
          this.cancelingOrderId = null;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (result) => {
          this.success = result.alreadyCanceled
            ? 'Order was already canceled.'
            : 'Order canceled. The reserved slot was released.';

          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.errorMessage(err, 'Unable to cancel this order.');

          this.load();
        },
      });
  }

  statusLabel(status: PhonePurchaseStatus): string {
    const labels: Record<PhonePurchaseStatus, string> = {
      PENDING_PAYMENT: 'Pending payment',
      READY: 'Ready',
      PURCHASING: 'Purchasing',
      PURCHASED: 'Purchased',
      PROVISIONING: 'Provisioning',
      COMPLETED: 'Completed',
      FAILED: 'Failed',
      RECONCILIATION_REQUIRED: 'Needs review',
      CANCELED: 'Canceled',
    };

    return labels[status];
  }

  formatPhone(phoneNumber: string): string {
    const match = phoneNumber.match(/^\+1(\d{3})(\d{3})(\d{4})$/);

    return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phoneNumber;
  }

  money(amount: string, currency: string): string {
    const parsed = Number(amount);

    if (!Number.isFinite(parsed)) {
      return '—';
    }

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(parsed);
    } catch {
      return `${amount} ${currency}`;
    }
  }

  private errorMessage(err: HttpErrorResponse, fallback: string): string {
    const message = err.error?.message;

    return Array.isArray(message)
      ? message.join(', ')
      : typeof message === 'string'
        ? message
        : fallback;
  }
}
