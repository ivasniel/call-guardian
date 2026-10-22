
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export type NotificationCategory =
  | 'JOB'
  | 'SCHOOL'
  | 'HEALTH'
  | 'PERSONAL'
  | 'BUSINESS'
  | 'SALES'
  | 'SPAM'
  | 'UNKNOWN';

export type PriorityFilter = 'ALL' | 'HIGH';

export type CategorySettings = Record<NotificationCategory, boolean>;

export interface NotificationPreferences {
  enabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  whatsappNumber: string | null;
  emailAddress: string | null;
  priorityFilter: PriorityFilter;
  categories: CategorySettings;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);

  getPreferences() {
    return this.http.get<NotificationPreferences>(
      '/notifications/preferences',
    );
  }

  updatePreferences(preferences: NotificationPreferences) {
    return this.http.put<NotificationPreferences>(
      '/notifications/preferences',
      preferences,
    );
  }
}
