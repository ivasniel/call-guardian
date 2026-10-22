
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import {
  NotificationsService,
  NotificationPreferences,
  NotificationCategory,
} from '../../services/notifications.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications implements OnInit {
  private readonly service = inject(NotificationsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  saving = false;
  error = '';
  success = '';

  preferences: NotificationPreferences | null = null;

  readonly categories: {
    key: NotificationCategory;
    title: string;
    description: string;
  }[] = [
    {
      key: 'JOB',
      title: 'Job Opportunities',
      description: 'Recruiters, interviews and employment opportunities',
    },
    {
      key: 'SCHOOL',
      title: 'School',
      description: 'Teachers, school offices and education matters',
    },
    {
      key: 'HEALTH',
      title: 'Health',
      description: 'Medical providers and appointment information',
    },
    {
      key: 'PERSONAL',
      title: 'Personal',
      description: 'Friends, family and personal messages',
    },
    {
      key: 'BUSINESS',
      title: 'Business',
      description: 'Clients and professional contacts',
    },
    {
      key: 'SALES',
      title: 'Sales',
      description: 'Promotions and commercial offers',
    },
    {
      key: 'SPAM',
      title: 'Spam',
      description: 'Suspicious and unwanted calls',
    },
    {
      key: 'UNKNOWN',
      title: 'Unknown',
      description: 'Calls that could not be classified',
    },
  ];

  ngOnInit(): void {
    this.loadPreferences();
  }

  loadPreferences(): void {
    this.loading = true;
    this.error = '';
    this.success = '';
    this.cdr.markForCheck();

    this.service.getPreferences()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: preferences => {
          this.preferences = preferences;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Unable to load notification preferences.';
          this.cdr.markForCheck();
        },
      });
  }

  savePreferences(): void {
    if (!this.preferences || this.saving) return;

    const preferences = this.preferences;

    if (
      preferences.enabled &&
      preferences.whatsappEnabled &&
      !/^\+[1-9]\d{7,14}$/.test(preferences.whatsappNumber || '')
    ) {
      this.error = 'Enter a valid WhatsApp number in E.164 format.';
      this.success = '';
      return;
    }

    if (
      preferences.enabled &&
      preferences.emailEnabled &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(preferences.emailAddress || '')
    ) {
      this.error = 'Enter a valid email address.';
      this.success = '';
      return;
    }

    this.saving = true;
    this.error = '';
    this.success = '';
    this.cdr.markForCheck();

    this.service.updatePreferences(preferences)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: updated => {
          this.preferences = updated;
          this.success = 'Notification preferences saved successfully.';
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Unable to save notification preferences.';
          this.cdr.markForCheck();
        },
      });
  }

  setCategory(category: NotificationCategory, enabled: boolean): void {
    if (!this.preferences) return;

    this.preferences.categories = {
      ...this.preferences.categories,
      [category]: enabled,
    };

    this.success = '';
  }

  selectImportantCategories(): void {
    if (!this.preferences) return;

    this.preferences.categories = {
      JOB: true,
      SCHOOL: true,
      HEALTH: true,
      PERSONAL: true,
      BUSINESS: true,
      SALES: false,
      SPAM: false,
      UNKNOWN: true,
    };

    this.success = '';
  }

  disableAllCategories(): void {
    if (!this.preferences) return;

    this.preferences.categories = {
      JOB: false,
      SCHOOL: false,
      HEALTH: false,
      PERSONAL: false,
      BUSINESS: false,
      SALES: false,
      SPAM: false,
      UNKNOWN: false,
    };

    this.success = '';
  }
}
