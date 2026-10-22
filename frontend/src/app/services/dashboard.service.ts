
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export type DashboardPeriod = 'today' | '7d' | '30d' | 'all';

export interface DashboardStats {
  totalCalls: number;
  highPriority: number;
  spamBlocked: number;
  callbacks: number;
}

export interface DashboardCategory {
  name: string;
  count: number;
  percentage: number;
}

export interface DashboardRecentCall {
  id: number;
  phone: string | null;
  callerName: string | null;
  organization: string | null;
  category: string | null;
  priority: string | null;
  decision: string;
  startedAt: string;
  summary: string | null;
}

export interface DashboardResponse {
  period: DashboardPeriod;
  stats: DashboardStats;
  categories: DashboardCategory[];
  recentCalls: DashboardRecentCall[];
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly http = inject(HttpClient);

  getStats(period: DashboardPeriod) {
    const params = new HttpParams().set('period', period);

    return this.http.get<DashboardResponse>('/calls/stats', {
      params,
    });
  }
}
