
import { Injectable, signal } from '@angular/core';

export type NoticeType = 'success' | 'error' | 'warning' | 'info';

export interface AppNotice {
  id: number;
  type: NoticeType;
  title: string;
  message: string;
}

export interface ConfirmDialog {
  title: string;
  message: string;
  confirmText: string;
  danger: boolean;
}

@Injectable({ providedIn: 'root' })
export class AppNotificationService {
  private nextId = 0;
  private readonly noticesState = signal<AppNotice[]>([]);
  private readonly confirmState = signal<ConfirmDialog | null>(null);
  private confirmResolver: ((result: boolean) => void) | null = null;

  readonly notices = this.noticesState.asReadonly();
  readonly confirmation = this.confirmState.asReadonly();

  success(title: string, message = ''): void {
    this.show('success', title, message);
  }

  error(title: string, message = ''): void {
    this.show('error', title, message);
  }

  warning(title: string, message = ''): void {
    this.show('warning', title, message);
  }

  info(title: string, message = ''): void {
    this.show('info', title, message);
  }

  private show(type: NoticeType, title: string, message: string): void {
    const id = ++this.nextId;

    this.noticesState.update(items => [
      ...items.slice(-3),
      { id, type, title, message },
    ]);

    setTimeout(() => this.dismiss(id), type === 'error' ? 6500 : 4200);
  }

  dismiss(id: number): void {
    this.noticesState.update(items =>
      items.filter(item => item.id !== id),
    );
  }

  confirm(options: {
    title: string;
    message: string;
    confirmText?: string;
    danger?: boolean;
  }): Promise<boolean> {
    // Evita abrir dos confirmaciones simultáneamente.
    if (this.confirmResolver) {
      return Promise.resolve(false);
    }

    this.confirmState.set({
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? 'Confirm',
      danger: options.danger ?? false,
    });

    return new Promise<boolean>(resolve => {
      this.confirmResolver = resolve;
    });
  }

  resolveConfirmation(accepted: boolean): void {
    const resolve = this.confirmResolver;
    this.confirmResolver = null;
    this.confirmState.set(null);
    resolve?.(accepted);
  }
}
