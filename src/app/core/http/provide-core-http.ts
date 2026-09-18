import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  authInterceptor,
  correlationIdInterceptor,
  localeInterceptor,
  provideApi,
  UMS_AUTH_CONFIG,
} from '@ums/shared';
import { APP_CONFIG, DEFAULT_APP_CONFIG } from '../config/app-config';
import { environment } from '../../../environments/environment';

/**
 * Wires this app's entire HTTP/API-client layer (FWEB-5, requirement-spec.md §2/§4 Observability
 * row/§6). A correlation id is threaded on every call (including attendance-sync and
 * grade-submission -- the audit-sensitive paths §4 names explicitly) via
 * {@link correlationIdInterceptor}, first in the chain.
 *
 * Interceptor order matters, mirroring `@ums/shared`'s own README ("Wiring it up"):
 * 1. {@link correlationIdInterceptor} first, so even a 401-triggered retry's very first attempt
 *    still carries a correlation id.
 * 2. {@link localeInterceptor} next, so every call (including the retry) carries the active
 *    locale (ADR-0011).
 * 3. {@link authInterceptor} last -- it clones the request again for a retry and reads/attaches
 *    the bearer token; its own third-party-origin token-leak bug is already fixed upstream
 *    (checks the request's origin against `config.baseUrl` before attaching), so it is used here
 *    with no workaround.
 *
 * `provideApi` wires `@ums/shared`'s generated OpenAPI client (Identity/Audit/Organization today)
 * with the same base URL as {@link UMS_AUTH_CONFIG}. Academic/Faculty/Notifications -- this app's
 * actual primary modules -- are not yet covered by that generated client (see
 * `core/api/*.api.ts`'s own doc comments, `ProvisionalModuleApiBase`) and are called by hand
 * through the same `HttpClient`/interceptor chain instead.
 */
export function provideCoreHttp(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_CONFIG,
      useValue: { ...DEFAULT_APP_CONFIG, apiBaseUrl: environment.apiBaseUrl },
    },
    provideHttpClient(
      withInterceptors([correlationIdInterceptor, localeInterceptor, authInterceptor]),
    ),
    {
      provide: UMS_AUTH_CONFIG,
      useFactory: () => ({ baseUrl: inject(APP_CONFIG).apiBaseUrl }),
    },
    provideApi({ basePath: environment.apiBaseUrl }),
  ]);
}
