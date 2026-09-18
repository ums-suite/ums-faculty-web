import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService, UmsToastContainerComponent } from '@ums/design-system';
import { SessionExpiryService } from './core/auth/session-expiry.service';
import { SessionTimeoutService } from './core/auth/session-timeout.service';
import { ConnectivityReconciliationService } from './core/pwa/connectivity-reconciliation.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, UmsToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Injected (not just imported) so ThemeService's constructor runs at bootstrap and applies the
  // `data-theme` attribute before first paint (FWEB-2, requirement-spec.md §7 "Full dark mode
  // support").
  private readonly theme = inject(ThemeService);

  // Injected purely so its constructor runs at bootstrap and its sessionExpired$ subscription is
  // live for the whole app session (FWEB-4).
  private readonly sessionExpiry = inject(SessionExpiryService);

  // Injected purely so its idle timer starts at bootstrap and stays live for the whole
  // authenticated session (FWEB-4, requirement-spec.md §5's shared-device timeout).
  private readonly sessionTimeout = inject(SessionTimeoutService);

  // Injected purely so its constructor runs at bootstrap and its `online` listener is live for
  // the whole app session (FWEB-7, FWEB-12's reconnect-triggered sync flush).
  private readonly connectivityReconciliation = inject(ConnectivityReconciliationService);

  constructor() {
    // `setRegister('operational')` opts into the design system's operational typography register
    // (a plainer, denser heading treatment than the marketing default) -- the one concrete
    // "calmer" visual hook `@ums/design-system` exposes for this app (see `styles.scss`'s own doc
    // comment for the rest of the "calmer/cooler" mandate, realized as usage discipline rather
    // than a forked token set, per ADR-0017's one-shared-visual-language rule).
    this.theme.setRegister('operational');
  }
}
