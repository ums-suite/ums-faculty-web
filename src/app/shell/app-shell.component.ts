import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import {
  type AppShellNavItem,
  UmsAppShellComponent,
  UmsBadgeComponent,
  UmsIconButtonComponent,
  UmsOfflineBannerComponent,
} from '@ums/design-system';
import { AuthService } from '../core/auth/auth.service';
import { AttendanceCacheClearService } from '../core/pwa/attendance-cache-clear.service';
import { ConnectivityService } from '../core/pwa/connectivity.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { TranslationService } from '../core/i18n/translation.service';
import { GlobalStore } from '../core/state/global.store';

interface FacultyNavItem extends AppShellNavItem {
  readonly path: string;
}

/**
 * The authenticated app shell (FWEB-6, requirement-spec.md §7): top bar + nav, `mode="operational"`
 * (a daily-use, between-classes operational portal, not a marketing surface). Wraps
 * `@ums/design-system`'s `UmsAppShellComponent`, owns nav-item-to-route mapping (the design system
 * component only emits `navItemClick`, it never navigates itself), and hosts the offline banner
 * (FWEB-7) so it is visible above every authenticated screen at once -- though per requirement-
 * spec.md §10.2, offline tolerance itself is scoped to Attendance only; the banner here is a
 * shared, app-wide connectivity indicator, not a claim every screen works offline.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    UmsAppShellComponent,
    UmsIconButtonComponent,
    UmsBadgeComponent,
    UmsOfflineBannerComponent,
    TranslatePipe,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly attendanceCacheClear = inject(AttendanceCacheClearService);
  private readonly translation = inject(TranslationService);
  protected readonly globalStore = inject(GlobalStore);
  protected readonly connectivity = inject(ConnectivityService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly navItems = computed<FacultyNavItem[]>(() => {
    const url = this.currentUrl();
    const items: Omit<FacultyNavItem, 'active'>[] = [
      { label: this.translation.t('shell.nav.dashboard'), icon: 'house', path: '/dashboard' },
      {
        label: this.translation.t('shell.nav.attendance'),
        icon: 'clipboard-text',
        path: '/attendance',
      },
      {
        label: this.translation.t('shell.nav.grading'),
        icon: 'graduation-cap',
        path: '/grading',
      },
      { label: this.translation.t('shell.nav.materials'), icon: 'book-open', path: '/materials' },
      { label: this.translation.t('shell.nav.leave'), icon: 'calendar', path: '/leave' },
      { label: this.translation.t('shell.nav.research'), icon: 'book-bookmark', path: '/research' },
      {
        label: this.translation.t('shell.nav.notifications'),
        icon: 'bell',
        path: '/notifications',
      },
    ];

    return items.map((item) => ({ ...item, href: item.path, active: url.startsWith(item.path) }));
  });

  /**
   * FWEB-29 note: the notification-badge poll (FWEB-8's `NotificationChannelService`) was wired
   * but never actually started anywhere in the app -- this is that missing call site, made here
   * since the shell exists for the entire authenticated session. Torn down on {@link logout}.
   */
  ngOnInit(): void {
    this.globalStore.connectNotifications();
  }

  protected onNavItemClick(item: AppShellNavItem): void {
    const path = (item as FacultyNavItem).path ?? item.href;
    if (path) {
      void this.router.navigateByUrl(path);
    }
  }

  protected toggleTheme(): void {
    const order: readonly ('light' | 'dark' | 'system')[] = ['system', 'light', 'dark'];
    const current = this.globalStore.themeMode();
    const next = order[(order.indexOf(current) + 1) % order.length];
    this.globalStore.setThemeMode(next);
  }

  protected toggleLocale(): void {
    this.globalStore.setLocale(this.globalStore.locale() === 'en' ? 'bn' : 'en');
  }

  /**
   * Clears attendance's own offline cache (FWEB-7, requirement-spec.md §5: sensitive
   * offline-queued student data must never survive a logout) alongside the generic session
   * clear -- these are deliberately two separate calls, not folded into `AuthService.logout()`
   * itself, since `AuthService` knows nothing about Attendance's own cache shape.
   */
  protected logout(): void {
    void this.attendanceCacheClear.clear();
    this.globalStore.disconnectNotifications();
    this.authService.logout().subscribe({
      complete: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }
}
