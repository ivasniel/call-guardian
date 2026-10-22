import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Pagination } from '../../shared/components/pagination/pagination';
import { CallsService, CallRecord, CallDetail, CallsResponse } from '../../services/calls.service';

@Component({
  selector: 'app-calls',
  standalone: true,
  imports: [DatePipe, FormsModule, Pagination],
  templateUrl: './calls.html',
  styleUrl: './calls.scss',
})
export class Calls implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly callsService = inject(CallsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  search = '';
  categoryFilter = 'ALL';
  priorityFilter = 'ALL';
  decisionFilter = 'ALL';

  currentPage = 1;
  pageSize = 10;
  totalItems = 0;

  calls: CallRecord[] = [];
  selectedCall: CallDetail | null = null;

  loading = false;
  detailsLoading = false;
  error = '';
  detailsError = '';

  readonly categories = [
    'ALL',
    'JOB',
    'SCHOOL',
    'HEALTH',
    'PERSONAL',
    'BUSINESS',
    'SALES',
    'SPAM',
    'UNKNOWN',
  ];

  ngOnInit(): void {
    this.reload$
      .pipe(
        debounceTime(200),

        tap(() => {
          this.loading = true;
          this.error = '';
          this.cdr.markForCheck();
        }),

        switchMap(() =>
          this.callsService
            .list({
              page: this.currentPage,
              pageSize: this.pageSize,
              search: this.search,
              category: this.categoryFilter,
              priority: this.priorityFilter,
              decision: this.decisionFilter,
            })
            .pipe(
              catchError((error: HttpErrorResponse) => {
                this.error =
                  error.status === 401
                    ? 'Your session has expired.'
                    : 'Unable to load calls. Please try again.';

                return of(null);
              }),
            ),
        ),

        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response: CallsResponse | null) => {
        this.loading = false;

        if (!response) {
          this.calls = [];
          this.totalItems = 0;
          this.cdr.markForCheck();
          return;
        }

        this.calls = response.items;
        this.totalItems = response.pagination.totalItems;
        this.currentPage = response.pagination.page;
        this.pageSize = response.pagination.pageSize;

        this.cdr.markForCheck();
      });

    this.loadCalls();
  }

  get paginatedCalls(): CallRecord[] {
    // MySQL ya devuelve únicamente los registros de la página.
    return this.calls;
  }

  loadCalls(): void {
    this.reload$.next();
  }

  onFiltersChange(): void {
    this.currentPage = 1;
    this.loadCalls();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadCalls();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadCalls();
  }

  clearFilters(): void {
    this.search = '';
    this.categoryFilter = 'ALL';
    this.priorityFilter = 'ALL';
    this.decisionFilter = 'ALL';
    this.currentPage = 1;
    this.loadCalls();
  }


showDetails(call: CallRecord): void {
  this.selectedCall = null;
  this.detailsError = '';
  this.detailsLoading = true;
  this.cdr.markForCheck();

  this.callsService.detail(call.id)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: detail => {
        this.selectedCall = detail;
        this.detailsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.detailsLoading = false;
        this.detailsError = 'Unable to load call details.';
        this.cdr.markForCheck();
      },
    });
}


  closeDetails(): void {
    this.selectedCall = null;
    this.detailsError = '';
  }

  formatDuration(seconds: number | null): string {
    if (seconds === null || seconds < 0) {
      return '—';
    }

    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);

    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  }

  callerLabel(call: CallRecord): string {
    return call.callerName?.trim() || call.organization?.trim() || 'Unknown Caller';
  }
}
