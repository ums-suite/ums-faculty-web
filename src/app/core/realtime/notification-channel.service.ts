import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { NotificationsApi } from '../api/notifications.api';
import { shortPoll } from './short-poll';

/**
 * In-app notification badge channel (FWEB-8, requirement-spec.md §2 Real-time/live-data row: "a
 * lightweight in-app notification badge (poll or SSE, implementation detail) for leave-approval
 * and grade-review-status updates"). §2 draws this app's own real-time-vs-not line explicitly:
 * "there is nothing here that benefits from sub-minute freshness enough to justify a persistent
 * channel" -- a short poll of the REAL, confirmed `GET /api/v1/notifications/me/unread-count`
 * endpoint (`NotificationCenterEndpoints.cs`) is deliberately simpler and cheaper to get right than
 * a push channel for this app's actual freshness need, mirroring `ums-student-web`'s own
 * `shortPoll` seat-availability precedent.
 */
@Injectable({ providedIn: 'root' })
export class NotificationChannelService implements OnDestroy {
  private readonly appConfig = inject(APP_CONFIG);
  private readonly notificationsApi = inject(NotificationsApi);

  private pollSubscription: Subscription | null = null;

  private readonly unreadCountState = signal(0);
  readonly unreadCount = this.unreadCountState.asReadonly();

  private readonly connectedState = signal(false);
  readonly connected = this.connectedState.asReadonly();

  connect(): void {
    if (this.pollSubscription) {
      return;
    }
    this.pollSubscription = shortPoll(
      () => this.notificationsApi.getUnreadCount(),
      this.appConfig.notificationPollIntervalMs,
    ).subscribe({
      next: (result) => {
        this.connectedState.set(true);
        this.unreadCountState.set(result.unreadCount);
      },
      // A poll failure (offline, transient 5xx) never throws into the caller -- the badge simply
      // stops updating until the next successful tick, matching this app's "fail closed and
      // quietly" posture for non-critical cross-cutting infra.
      error: () => this.connectedState.set(false),
    });
  }

  disconnect(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
    this.connectedState.set(false);
  }

  /** Manual reset, e.g. once the faculty member opens the notification center and reads everything. */
  clearUnread(): void {
    this.unreadCountState.set(0);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
