import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';

import {
  AccountType,
  AdminAccount,
  AdminAccountsService,
  CreateAdminAccountRequest,
  AdminLockMode,
} from '../../../services/admin-accounts.service';

import { AppNotificationService } from '../../../shared/services/app-notification.service';

@Component({
  selector: 'app-admin-clients',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './admin-clients.html',
  styleUrl: './admin-clients.scss',
})
export class AdminClients implements OnInit {
  private readonly accountsService = inject(AdminAccountsService);

  private readonly notifications = inject(AppNotificationService);

  private readonly cdr = inject(ChangeDetectorRef);

  lockTarget: AdminAccount | null = null;
  lockMode: Exclude<AdminLockMode, 'NONE'> = 'PURCHASES';
  lockReason = '';
  lockSaving = false;

  accounts: AdminAccount[] = [];

  loading = false;
  saving = false;
  error = '';

  search = '';
  status = 'ALL';
  accountType: AccountType | 'ALL' = 'ALL';

  page = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 1;

  showCreateForm = false;

  form: CreateAdminAccountRequest = this.emptyForm();

  ngOnInit(): void {
    this.loadAccounts();
  }

  private emptyForm(): CreateAdminAccountRequest {
    return {
      name: '',
      accountType: 'BUSINESS',
      ownerName: '',
      ownerEmail: '',
      ownerPhone: '',
      password: '',
    };
  }

  loadAccounts(): void {
    this.loading = true;
    this.error = '';

    this.accountsService
      .list({
        page: this.page,
        pageSize: this.pageSize,
        search: this.search,
        status: this.status,
        accountType: this.accountType,
      })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.accounts = response.items;
          this.page = response.pagination.page;
          this.pageSize = response.pagination.pageSize;
          this.totalItems = response.pagination.totalItems;
          this.totalPages = response.pagination.totalPages;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Unable to load customer accounts.';
          this.notifications.error(this.error);
          this.cdr.markForCheck();
        },
      });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadAccounts();
  }

  changePage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages || this.loading) {
      return;
    }

    this.page = nextPage;
    this.loadAccounts();
  }

  changePageSize(value: string): void {
    this.pageSize = Number(value);
    this.page = 1;
    this.loadAccounts();
  }

  openCreateForm(): void {
    this.form = this.emptyForm();
    this.showCreateForm = true;
  }

  closeCreateForm(): void {
    if (this.saving) return;
    this.showCreateForm = false;
  }

  createAccount(): void {
    if (this.saving) return;

    this.saving = true;

    this.accountsService
      .create({
        ...this.form,
        name: this.form.name.trim(),
        ownerName: this.form.ownerName.trim(),
        ownerEmail: this.form.ownerEmail.trim(),
        ownerPhone: this.form.ownerPhone.trim(),
      })
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.showCreateForm = false;
          this.form = this.emptyForm();
          this.page = 1;

          this.notifications.success('Customer account created successfully.');

          this.loadAccounts();
        },
        error: (error) => {
          const serverMessage = error.error?.message;

          const message =
            typeof serverMessage === 'string'
              ? serverMessage
              : Array.isArray(serverMessage)
                ? serverMessage.join(', ')
                : 'Unable to create customer account.';

          this.notifications.error(message);
          this.cdr.markForCheck();
        },
      });
  }

  get firstItem(): number {
    return this.totalItems === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get lastItem(): number {
    return Math.min(this.page * this.pageSize, this.totalItems);
  }

  openLockModal(account: AdminAccount): void {
    this.lockTarget = account;
    this.lockMode =
      account.adminLocked && account.adminLockMode !== 'NONE' ? account.adminLockMode : 'PURCHASES';

    this.lockReason = '';
  }

  closeLockModal(): void {
    if (this.lockSaving) return;

    this.lockTarget = null;
    this.lockReason = '';
  }

  saveLock(): void {
    if (!this.lockTarget || this.lockSaving) return;

    const reason = this.lockReason.trim();

    if (!reason || reason.length > 500) {
      this.notifications.warning('Enter a reason between 1 and 500 characters.');
      return;
    }

    const accountId = this.lockTarget.id;
    this.lockSaving = true;

    this.accountsService
      .lockAccount(accountId, this.lockMode, reason)
      .pipe(
        finalize(() => {
          this.lockSaving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.lockTarget = null;
          this.lockReason = '';

          this.notifications.success('Administrative restriction saved.');

          this.loadAccounts();
        },
        error: (error) => {
          this.notifications.error(
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'Unable to update account restriction.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  async unlockAccount(account: AdminAccount): Promise<void> {
    if (this.lockSaving || !account.adminLocked) return;

    const confirmed = await this.notifications.confirm({
      title: 'Unlock customer account?',
      message: `Remove the administrative restriction from ${account.name}?`,
      confirmText: 'Unlock Account',
      danger: false,
    });

    if (!confirmed) return;

    // The backend requires an audit reason.
    const reason = 'Administrative restriction removed by Super Admin';

    this.lockSaving = true;

    this.accountsService
      .unlockAccount(account.id, reason)
      .pipe(
        finalize(() => {
          this.lockSaving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.notifications.success('Account administrative restriction removed.');
          this.loadAccounts();
        },
        error: (error) => {
          this.notifications.error(
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'Unable to unlock account.',
          );
          this.cdr.markForCheck();
        },
      });
  }
}
