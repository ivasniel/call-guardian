
import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  AdminAccountsService,
  AccountSubscription,
  CourtesyPlanInput,
} from '../../../services/admin-accounts.service';


@Component({
  selector: 'app-courtesy-plan-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './courtesy-plan-dialog.html',
  styleUrl: './courtesy-plan-dialog.scss',
})
export class CourtesyPlanDialog implements OnChanges {
  @Input() accountId: number | null = null;
  @Input() accountName = '';

  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  loading = false;
  saving = false;
  error = '';
  success = '';

  subscription: AccountSubscription | null = null;

  mode: 'GRANT' | 'EXTEND' | 'LIMITS' | 'REVOKE' = 'GRANT';

  form: CourtesyPlanInput = this.defaultForm();

  additionalDays = 7;

constructor(
  private readonly api: AdminAccountsService,
  private readonly cdr: ChangeDetectorRef,
) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accountId'] && this.accountId) {
      this.load();
    }
  }

  private defaultForm(): CourtesyPlanInput {
    return {
      durationDays: 30,
      maxUsers: 1,
      maxNumbers: 1,
      includedCalls: 100,
      includedMinutes: 100,
      allowAdditionalNumbers: false,
      reason: '',
    };
  }

get activeCourtesy(): boolean {
  return (
    this.subscription?.source === 'ADMIN_COURTESY' &&
    this.subscription?.status === 'ACTIVE' &&
    this.subscription?.currentlyActive === true
  );
}

 
load(): void {
  if (!this.accountId) return;

  this.loading = true;
  this.error = '';
  this.success = '';

  this.cdr.detectChanges();

  this.api.getSubscription(this.accountId)
    .pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (response) => {
        this.subscription = response.subscription;
console.log('Subscription:', this.subscription);
console.log('Source:', this.subscription?.source);
console.log('Status:', this.subscription?.status);
console.log('Currently Active:', this.subscription?.currentlyActive);
console.log('Active Courtesy:', this.activeCourtesy);
console.log('Subscription dates:', {
  startsAt: this.subscription?.starts_at,
  endsAt: this.subscription?.ends_at,
  currentlyActive: this.subscription?.currentlyActive,
});
        if (this.subscription) {
          this.form = {
            durationDays: 30,
            maxUsers: Number(this.subscription.max_users),
            maxNumbers: Number(this.subscription.max_numbers),
            includedCalls: Number(this.subscription.included_calls),
            includedMinutes: Number(this.subscription.included_minutes),
            allowAdditionalNumbers:
              Boolean(Number(this.subscription.allow_additional_numbers)),
            reason: '',
          };
        } else {
          this.form = this.defaultForm();
        }

        this.mode = this.activeCourtesy ? 'EXTEND' : 'GRANT';
      },
      error: (err) => {
        const message = err?.error?.message;

        this.error = Array.isArray(message)
          ? message.join(', ')
          : message || 'Unable to load subscription.';
      },
    });
}


  setMode(mode: 'GRANT' | 'EXTEND' | 'LIMITS' | 'REVOKE') {
    this.mode = mode;
    this.error = '';
    this.success = '';
    this.form.reason = '';
  }

  save(): void {
    if (!this.accountId || this.saving) return;

    if (!this.form.reason.trim()) {
      this.error = 'Reason is required.';
      return;
    }

    this.error = '';
    this.success = '';
    this.saving = true;

    let request;

    switch (this.mode) {
      case 'EXTEND':
        request = this.api.extendCourtesy(
          this.accountId,
          this.additionalDays,
          this.form.reason
        );
        break;

      case 'LIMITS':
        request = this.api.updateCourtesyLimits(
          this.accountId,
          {
            maxUsers: this.form.maxUsers,
            maxNumbers: this.form.maxNumbers,
            includedCalls: this.form.includedCalls,
            includedMinutes: this.form.includedMinutes,
            allowAdditionalNumbers: this.form.allowAdditionalNumbers,
            reason: this.form.reason,
          }
        );
        break;

      case 'REVOKE':
        request = this.api.revokeCourtesy(
          this.accountId,
          this.form.reason
        );
        break;

      default:
        request = this.api.grantCourtesy(
          this.accountId,
          this.form
        );
    }

    request
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: () => {
          this.updated.emit();
          this.load();
          this.success = 'Courtesy plan updated successfully.';
        },
        error: (err) => {
          const message = err?.error?.message;

          this.error = Array.isArray(message)
            ? message.join(', ')
            : message || 'Operation failed.';
        },
      });
  }

  close(): void {
    this.closed.emit();
  }
  
}
