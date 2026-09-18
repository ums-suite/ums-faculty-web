import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { NotificationsApi } from '../../core/api/notifications.api';
import type { InAppNotificationDto } from '../../core/api/notifications.types';
import { shortPoll } from '../../core/realtime/short-poll';

/** The assumed category `Notifications` would fan a `GradeLocked` event out under, per design-decisions.md's "Grade-Batch Lock Notification" decision. **Confirmed cross-team gap**: `Academic`'s `GradeLocked` domain event (`Academic.Domain.Events.GradeLocked.cs`, real and already raised by `ResultPublicationService.LockAsync`) has no consumer registered anywhere in Notifications' own module today -- verified by inspecting Notifications' event-consumer wiring, which has no Academic-sourced subscription at all. This constant and {@link GradeLockListenerService} are built against the plausible shape design-decisions.md itself describes ("a small Academic-side fan-out addition... flagged for coordination"), the same posture every other assumed-endpoint gap in this build takes -- not a fabricated guarantee that a real notification will ever arrive until that fan-out ships. */
export const GRADE_LOCKED_NOTIFICATION_CATEGORY = 'GradeLocked';

/**
 * FWEB-18's edge-case mechanism (design-decisions.md "Grade-Batch Lock Notification"): extends the
 * existing FWEB-8 notification-badge channel with a listener for a lock-transition event on
 * whatever CourseOffering the Grading table currently has open, rather than a dedicated poll loop
 * of its own -- reuses the identical `shortPoll` + `NotificationsApi.listMyNotifications` shape
 * `NotificationChannelService` already established for the unread-count badge.
 *
 * `GradingStore` starts this listener when a Grading session opens and stops it on close; on a
 * match it emits the notification once via {@link lockedNotice} so the store can freeze editing
 * and preserve any not-yet-submitted local values as a view-only draft (never submittable), per
 * the edge case's own resolution -- never a silent, un-signaled interruption.
 */
@Injectable({ providedIn: 'root' })
export class GradeLockListenerService implements OnDestroy {
  private readonly appConfig = inject(APP_CONFIG);
  private readonly notificationsApi = inject(NotificationsApi);

  private pollSubscription: Subscription | null = null;
  private readonly seenNotificationIds = new Set<string>();

  private readonly lockedNoticeState = signal<InAppNotificationDto | null>(null);
  /** The first still-unseen `GradeLocked`-category notification observed since {@link start} was called, or `null`. Cleared by {@link acknowledge}/{@link stop}. */
  readonly lockedNotice = this.lockedNoticeState.asReadonly();

  /** Begins polling for a lock-transition notice. Idempotent -- a second `start()` while already running is a no-op. */
  start(): void {
    if (this.pollSubscription) {
      return;
    }
    this.pollSubscription = shortPoll(
      () => this.notificationsApi.listMyNotifications(0, 20),
      this.appConfig.notificationPollIntervalMs,
    ).subscribe({
      next: (notifications) => this.handleNotifications(notifications),
      // Same fail-closed-and-quietly posture as NotificationChannelService -- a poll failure never
      // surfaces as a fake lock notice, it simply tries again next tick.
      error: () => undefined,
    });
  }

  stop(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
    this.seenNotificationIds.clear();
    this.lockedNoticeState.set(null);
  }

  acknowledge(): void {
    this.lockedNoticeState.set(null);
  }

  private handleNotifications(notifications: readonly InAppNotificationDto[]): void {
    for (const notification of notifications) {
      if (this.seenNotificationIds.has(notification.id)) {
        continue;
      }
      this.seenNotificationIds.add(notification.id);
      if (!notification.isRead && notification.category === GRADE_LOCKED_NOTIFICATION_CATEGORY) {
        this.lockedNoticeState.set(notification);
        return;
      }
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
