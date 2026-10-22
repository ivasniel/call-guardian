
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AccountPhone {
  id: number;
  number: string;
  active: boolean;
  isPrimary: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AccountPhonesService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<AccountPhone[]> {
    return this.http.get<AccountPhone[]>('/account/phones');
  }
}
