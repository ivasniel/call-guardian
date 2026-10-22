
import { Component, inject } from '@angular/core';
import { AppNotificationService } from '../../services/app-notification.service';

@Component({
  selector: 'app-notifications-host',
  standalone: true,
  templateUrl: './app-notifications.html',
  styleUrl: './app-notifications.scss',
})
export class AppNotifications {
  readonly notify = inject(AppNotificationService);
}
