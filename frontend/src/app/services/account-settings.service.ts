import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AccountSettings {
  accountId: number;
  agentEnabled: boolean;
  language: 'auto' | 'en' | 'es';
  greetingEn: string;
  greetingEs: string;
  maxFollowups: number;
  earlySpamScreening: boolean;
  callbackVerification: boolean;
}

export type UpdateAccountSettings =
  Partial<Omit<AccountSettings, 'accountId'>>;

@Injectable({
  providedIn: 'root',
})
export class AccountSettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = '/account/settings';

  get(): Observable<AccountSettings> {
    return this.http.get<AccountSettings>(this.url);
  }

  update(
    changes: UpdateAccountSettings,
  ): Observable<AccountSettings> {
    return this.http.put<AccountSettings>(
      this.url,
      changes,
    );
  }
}