import { Injectable, inject } from '@angular/core';
import { CurrentUserService, LocaleService, type UmsLocale } from '@ums/shared';
import { ThemeService, type ThemeMode } from '@ums/design-system';
import { FacultyIdentityService } from '../auth/faculty-identity.service';
import { NotificationChannelService } from '../realtime/notification-channel.service';

/**
 * The one small global store (FWEB-6, requirement-spec.md §2 State management row: "global store
 * (session, locale, theme, notification badge)"). A thin facade over `@ums/shared`/
 * `@ums/design-system`/this app's own `FacultyIdentityService`'s already-reactive state -- this
 * store does not duplicate their state, it just gives the app shell and every feature a single
 * place to read "the current cross-cutting session context" without importing four different
 * services by hand.
 *
 * Per-feature stores (Dashboard, Attendance, Grading, Materials, Leave, Research) are each their
 * own injectable, scoped to their own feature module -- this store is deliberately never a
 * god-object the feature stores reach into for domain data.
 */
@Injectable({ providedIn: 'root' })
export class GlobalStore {
  private readonly currentUser = inject(CurrentUserService);
  private readonly facultyIdentity = inject(FacultyIdentityService);
  private readonly localeService = inject(LocaleService);
  private readonly themeService = inject(ThemeService);
  private readonly notificationChannel = inject(NotificationChannelService);

  readonly userId = this.currentUser.userId;
  readonly roles = this.currentUser.roles;
  readonly isDepartmentHead = () => this.currentUser.hasRole('DepartmentHead');

  /** See `FacultyIdentityService`'s own doc comment for the confirmed self-lookup backend gap this resolves around. */
  readonly facultyMemberId = this.facultyIdentity.facultyMemberId;

  readonly locale = this.localeService.locale;

  readonly themeMode = this.themeService.mode;
  readonly resolvedTheme = this.themeService.resolvedTheme;

  readonly unreadNotificationCount = this.notificationChannel.unreadCount;
  readonly notificationChannelConnected = this.notificationChannel.connected;

  setLocale(locale: UmsLocale): void {
    this.localeService.setLocale(locale);
  }

  setThemeMode(mode: ThemeMode): void {
    this.themeService.setMode(mode);
  }

  connectNotifications(): void {
    this.notificationChannel.connect();
  }

  disconnectNotifications(): void {
    this.notificationChannel.disconnect();
  }
}
