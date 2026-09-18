import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideCoreHttp } from './core/http/provide-core-http';
import { routes } from './app.routes';

/**
 * FWEB-7: the service worker is registered `registerWhenStable:30000` (Angular CLI's own
 * PWA-schematic default) so it never competes with the initial bundle for bandwidth/CPU on first
 * paint.
 *
 * `ngsw-config.json`'s `dataGroups` cache only GET reads feeding Attendance's own course/roster
 * context (`ums-core`'s Angular service worker `dataGroups` mechanism caches GET responses only --
 * it has no concept of queuing a POST for later replay). The actual offline-write path this app's
 * §2/§10.2 "attendance marking fully functional offline with background sync" mandate describes is
 * therefore entirely application-level, not ngsw-driven: `AttendanceStore`'s own local-dirty/
 * pending-sync queue (persisted via `AttendanceOfflineStorageService`) plus `registerAttendanceSync`
 * (`core/pwa/background-sync.util.ts`) and a plain `online`-event flush
 * (`ConnectivityReconciliationService`) are what actually carry a queued mark to the server once
 * connectivity returns. Grading/Materials/Leave/Research mutations are never cached or queued, so
 * those calls fail as a real network error while offline rather than being silently served stale.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideCoreHttp(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
