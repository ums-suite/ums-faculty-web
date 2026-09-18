import { Injectable, computed, inject, signal } from '@angular/core';
import { NotificationsApi } from '../../core/api/notifications.api';
import type { InAppNotificationDto } from '../../core/api/notifications.types';
import { NotificationChannelService } from '../../core/realtime/notification-channel.service';

/**
 * Notification Center store (FWEB-29) -- a simple chronological list of leave decisions,
 * review-status changes, and low-attendance flags, wired to the existing FWEB-8 badge channel
 * (`NotificationChannelService`): reading here clears the badge count the same way it would on any
 * other in-app read action. Deliberately unremarkable (§7: "this app's visual budget is spent on
 * Dashboard/Attendance, not here") -- no bespoke reconciliation logic of its own, just the real
 * `GET /notifications/me` / `PATCH .../read` / `PATCH .../read-all` endpoints
 * (`project_ums_frontend_gotchas.md` confirms these are real, not assumed).
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterStore {
  private readonly notificationsApi = inject(NotificationsApi);
  private readonly notificationChannel = inject(NotificationChannelService);

  private readonly notificationsState = signal<readonly InAppNotificationDto[]>([]);
  private readonly isLoadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  /** Newest first -- a simple chronological list, per the ticket's own "deliberately unremarkable" design note. */
  readonly notifications = computed(() =>
    [...this.notificationsState()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  readonly isLoading = this.isLoadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly hasUnread = computed(() => this.notificationsState().some((n) => !n.isRead));

  load(): void {
    this.isLoadingState.set(true);
    this.errorState.set(null);
    this.notificationsApi.listMyNotifications(0, 50).subscribe({
      next: (list) => {
        this.notificationsState.set(list);
        this.isLoadingState.set(false);
      },
      error: () => {
        this.errorState.set('notifications.error.loadFailed');
        this.isLoadingState.set(false);
      },
    });
  }

  markRead(id: string): void {
    this.notificationsApi.markRead(id).subscribe({
      next: () => {
        this.notificationsState.update((list) =>
          list.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
        this.recomputeBadge();
      },
      error: () => this.errorState.set('notifications.error.markReadFailed'),
    });
  }

  markAllRead(): void {
    this.notificationsApi.markAllRead().subscribe({
      next: () => {
        this.notificationsState.update((list) => list.map((n) => ({ ...n, isRead: true })));
        this.notificationChannel.clearUnread();
      },
      error: () => this.errorState.set('notifications.error.markReadFailed'),
    });
  }

  private recomputeBadge(): void {
    if (!this.hasUnread()) {
      this.notificationChannel.clearUnread();
    }
  }
}
