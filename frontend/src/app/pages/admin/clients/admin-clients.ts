
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  AdminAccount,
  AdminAccountsService,
  CreateAdminAccountRequest,
} from '../../../services/admin-accounts.service';
import { AppNotificationService } from '../../../shared/services/app-notification.service';
import { DatePipe } from '@angular/common';
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

  accounts: AdminAccount[] = [];
  loading = false;
  saving = false;
  error = '';

  search = '';
  status = 'ALL';

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
      ownerName: '',
      ownerEmail: '',
      ownerPhone: '',
      password: '',
    };
  }

  loadAccounts(): void {
    this.loading = true;
    this.error = '';

    this.accountsService.list({
      page: this.page,
      pageSize: this.pageSize,
      search: this.search,
      status: this.status,
    })
    .pipe(finalize(() => {
      this.loading = false;
      this.cdr.markForCheck();
    }))
    .subscribe({
      next: response => {
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
    if (
      nextPage < 1 ||
      nextPage > this.totalPages ||
      this.loading
    ) return;

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

    this.accountsService.create(this.form)
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          this.showCreateForm = false;
          this.form = this.emptyForm();
          this.page = 1;

          this.notifications.success(
            'Customer account created successfully.',
          );

          this.loadAccounts();
        },
        error: error => {
          const message =
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'Unable to create customer account.';

          this.notifications.error(message);
          this.cdr.markForCheck();
        },
      });
  }

  get firstItem(): number {
    return this.totalItems === 0
      ? 0
      : (this.page - 1) * this.pageSize + 1;
  }

  get lastItem(): number {
    return Math.min(
      this.page * this.pageSize,
      this.totalItems,
    );
  }
}
