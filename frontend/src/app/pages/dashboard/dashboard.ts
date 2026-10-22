
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import {
  DashboardService,
  DashboardPeriod,
  DashboardStats,
  DashboardCategory,
  DashboardRecentCall,
} from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  period: DashboardPeriod = '30d';

  loading = false;
  error = '';

  stats: DashboardStats = {
    totalCalls: 0,
    highPriority: 0,
    spamBlocked: 0,
    callbacks: 0,
  };

  categories: DashboardCategory[] = [];
  recentCalls: DashboardRecentCall[] = [];

  private requestId = 0;

  ngOnInit(): void {
    this.loadDashboard();
  }

  get statCards() {
    return [
      {
        label: 'Total Calls',
        value: this.stats.totalCalls,
        icon: '☎',
        change: 'Received calls',
      },
      {
        label: 'High Priority',
        value: this.stats.highPriority,
        icon: '!',
        change: 'Important calls',
      },
      {
        label: 'Spam Blocked',
        value: this.stats.spamBlocked,
        icon: '⊘',
        change: 'Rejected or blocked',
      },
      {
        label: 'Callbacks',
        value: this.stats.callbacks,
        icon: '↗',
        change: 'Callback requested',
      },
    ];
  }

  get maxCategoryCount(): number {
    return Math.max(
      1,
      ...this.categories.map(category => category.count),
    );
  }

  onPeriodChange(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    const currentRequest = ++this.requestId;

    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    this.dashboardService.getStats(this.period)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (currentRequest === this.requestId) {
            this.loading = false;
            this.cdr.markForCheck();
          }
        }),
      )
      .subscribe({
        next: response => {
          if (currentRequest !== this.requestId) return;

          this.stats = response.stats;
          this.categories = response.categories;
          this.recentCalls = response.recentCalls;
          this.cdr.markForCheck();
        },
        error: () => {
          if (currentRequest !== this.requestId) return;

          this.error = 'Unable to load dashboard statistics.';
          this.cdr.markForCheck();
        },
      });
  }

  callerLabel(call: DashboardRecentCall): string {
    return (
      call.callerName?.trim() ||
      call.organization?.trim() ||
      'Unknown Caller'
    );
  }
}
