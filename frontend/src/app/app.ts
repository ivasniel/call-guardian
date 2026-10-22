
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNotifications } from './shared/components/app-notifications/app-notifications';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppNotifications],
  template: `
    <router-outlet />
    <app-notifications-host />
  `,
})
export class App {}
