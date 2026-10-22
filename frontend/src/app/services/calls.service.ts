
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export type CallPriority = 'HIGH' | 'NORMAL' | 'LOW' | null;

export type CallDecision =
  | 'KNOWN'
  | 'UNKNOWN'
  | 'BLOCKED'
  | 'URGENT'
  | 'NORMAL'
  | 'SPAM';

export interface CallRecord {
  id: number;
  phone: string | null;
  calledNumber: string | null;
  callerName: string | null;
  organization: string | null;
  category: string | null;
  priority: CallPriority;
  decision: CallDecision;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  summary: string | null;
  callbackRequested: boolean | number | null;
}

export interface CallDetail extends CallRecord {
  callControlId: string;
  reason: string | null;
  transcript: string | null;
  transcriptLanguage: string | null;
  classificationSource: string | null;
  callbackPhone: string | null;
  callbackConfirmed: boolean;
  callbackPhoneSource: 'CALLER_ID' | 'PROVIDED' | null;
}

export interface CallsQuery {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  priority?: string;
  decision?: string;
}

export interface CallsResponse {
  items: CallRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class CallsService {
  private readonly http = inject(HttpClient);

  list(query: CallsQuery) {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize);

    if (query.search?.trim()) {
      params = params.set('search', query.search.trim());
    }

    if (query.category && query.category !== 'ALL') {
      params = params.set('category', query.category);
    }

    if (query.priority && query.priority !== 'ALL') {
      params = params.set('priority', query.priority);
    }

    if (query.decision && query.decision !== 'ALL') {
      params = params.set('decision', query.decision);
    }

    return this.http.get<CallsResponse>('/calls', { params });
  }

  detail(id: number) {
    return this.http.get<CallDetail>(`/calls/${id}`);
  }
}
