
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';

import { AppNotificationService } from '../../shared/services/app-notification.service';

import {
  AccountSettings,
  AccountSettingsApiService,
} from '../../services/account-settings.service';

type SettingsTab = 'profile' | 'agent' | 'phone';

interface ProfileSettings {
  name: string;
  email: string;
  phone: string;
}

interface AgentSettings {
  enabled: boolean;
  language: 'auto' | 'en' | 'es';
  greetingEn: string;
  greetingEs: string;
  maxFollowUps: number;
  spamScreening: boolean;
  askCallbackPhone: boolean;
}

interface PhoneLine {
  id: number;
  number: string;
  label: string;
  active: boolean;
}

interface CurrentUser {
  id: number;
  name: string;
  email: string | null;
  phone?: string | null;
  phone_e164?: string | null;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  private readonly notify = inject(AppNotificationService);
  private readonly accountApi = inject(AccountSettingsApiService);
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

  activeTab: SettingsTab = 'profile';

  profileLoading = false;
  agentLoading = false;
  agentSaving = false;
  agentLoaded = false;
  agentError = '';

  profile: ProfileSettings = {
    name: '',
    email: '',
    phone: '',
  };

  agent: AgentSettings = {
    enabled: true,
    language: 'auto',
    greetingEn: '',
    greetingEs: '',
    maxFollowUps: 6,
    spamScreening: true,
    askCallbackPhone: true,
  };

  // Phone Settings sigue sin conexión con el backend.
  // No mostramos números inventados.
  phoneLines: PhoneLine[] = [];

  ngOnInit(): void {
    this.loadProfile();
    this.loadAgent();
  }

  changeTab(tab: SettingsTab): void {
    this.activeTab = tab;
  }

  loadProfile(): void {
    this.profileLoading = true;

    this.http.get<CurrentUser>('/auth/me')
      .pipe(
        finalize(() => {
          this.profileLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: user => {
          this.profile = {
            name: user.name || '',
            email: user.email || '',
            phone: user.phone ?? user.phone_e164 ?? '',
          };
          this.cdr.markForCheck();
        },
        error: () => {
          this.notify.error(
            'Profile unavailable',
            'Could not load your account information.',
          );
          this.cdr.markForCheck();
        },
      });
  }

  loadAgent(): void {
    this.agentLoading = true;
    this.agentLoaded = false;
    this.agentError = '';

    this.accountApi.get()
      .pipe(
        finalize(() => {
          this.agentLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: settings => {
          this.applyAgentSettings(settings);
          this.agentLoaded = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.agentError = 'Unable to load AI Agent Settings.';
          this.notify.error(
            'Settings unavailable',
            this.agentError,
          );
          this.cdr.markForCheck();
        },
      });
  }

  private applyAgentSettings(settings: AccountSettings): void {
    this.agent = {
      enabled: settings.agentEnabled,
      language: settings.language,
      greetingEn: settings.greetingEn,
      greetingEs: settings.greetingEs,
      maxFollowUps: settings.maxFollowups,
      spamScreening: settings.earlySpamScreening,
      askCallbackPhone: settings.callbackVerification,
    };
  }

  saveProfile(): void {
    this.notify.info(
      'Coming soon',
      'Profile editing is not connected yet. Your registered email cannot be changed.',
    );
  }

  saveAgent(): void {
    if (this.agentLoading || this.agentSaving || !this.agentLoaded) {
      return;
    }

    if (
      !Number.isInteger(this.agent.maxFollowUps) ||
      this.agent.maxFollowUps < 1 ||
      this.agent.maxFollowUps > 15
    ) {
      this.notify.warning(
        'Invalid question limit',
        'Choose a value between 1 and 15.',
      );
      return;
    }

    if (
      !this.agent.greetingEn.trim() ||
      !this.agent.greetingEs.trim() ||
      this.agent.greetingEn.length > 500 ||
      this.agent.greetingEs.length > 500
    ) {
      this.notify.warning(
        'Invalid greeting',
        'Enter both greetings (maximum 500 characters each).',
      );
      return;
    }

    this.agentSaving = true;

    this.accountApi.update({
      agentEnabled: this.agent.enabled,
      language: this.agent.language,
      greetingEn: this.agent.greetingEn.trim(),
      greetingEs: this.agent.greetingEs.trim(),
      maxFollowups: this.agent.maxFollowUps,
      earlySpamScreening: this.agent.spamScreening,
      callbackVerification: this.agent.askCallbackPhone,
    })
      .pipe(
        finalize(() => {
          this.agentSaving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: settings => {
          this.applyAgentSettings(settings);
          this.notify.success(
            'Settings saved',
            'Your AI Agent Settings were saved to MySQL. Live call integration is still pending.',
          );
          this.cdr.markForCheck();
        },
        error: error => {
          const message =
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'Unable to save AI Agent Settings.';

          this.notify.error('Save failed', message);
          this.cdr.markForCheck();
        },
      });
  }

  async togglePhoneLine(line: PhoneLine): Promise<void> {
    const confirmed = await this.notify.confirm({
      title: line.active ? 'Disable phone line?' : 'Enable phone line?',
      message: line.active
        ? 'Phone management is not yet connected to the backend.'
        : 'Phone management is not yet connected to the backend.',
      confirmText: 'OK',
    });

    if (!confirmed) return;

    this.notify.info(
      'Coming soon',
      'Phone line status has not been changed in Telnyx or MySQL.',
    );
  }
}
