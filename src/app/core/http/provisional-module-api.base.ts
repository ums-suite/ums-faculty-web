import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { toUmsApiError, type UmsApiError } from '@ums/shared';
import { APP_CONFIG } from '../config/app-config';

/**
 * Base for a **provisional** module data-access client (FWEB-5).
 *
 * `@ums/shared`'s committed OpenAPI contract (`contracts/ums-core.v1.json`) currently covers only
 * Identity, Audit, and Organization (~41 operations) -- `Academic`, `Faculty`, and `Notifications`
 * (requirement-spec.md §6, this app's actual primary/supporting modules) have not yet shipped a
 * generated TypeScript client, even though all three are real and implemented server-side in
 * `ums-core` (verified directly against its `src/UMS.Modules/*` source, not guessed). Every
 * module data-access service for those extends this class instead of hand-rolling its own
 * `HttpClient` plumbing, so:
 *
 * - they share the exact same base URL as the generated client and `UMS_AUTH_CONFIG`
 *   ({@link APP_CONFIG}, wired in `provide-core-http.ts`);
 * - they automatically pick up the same interceptor chain (correlation id, locale, bearer/refresh)
 *   since they go through the same injected `HttpClient`;
 * - every failure is normalized through `toUmsApiError`, matching what a generated service's
 *   consumers already get, so a feature never has to special-case "provisional module" error
 *   handling versus "generated module" error handling;
 * - replacing one with `@ums/shared`'s real generated equivalent later is a mechanical swap of the
 *   class a feature module injects, not a rewrite of how it calls or handles errors.
 *
 * Each subclass's own doc comment names the concrete endpoint paths it assumes, verified against
 * `ums-core/src/UMS.Modules/<Module>/UMS.Modules.<Module>.Api/Endpoints/*.cs` directly, and flags
 * any confirmed gap (a route the frontend needs but the backend doesn't have yet) rather than
 * guessing. **Never rely on one of these for anything security-sensitive beyond what the server
 * itself enforces** -- exactly like a generated client, this is a thin HTTP wrapper, not a trust
 * boundary.
 */
export abstract class ProvisionalModuleApiBase {
  protected readonly http = inject(HttpClient);
  private readonly appConfig = inject(APP_CONFIG);

  /** `ums-core`'s base origin, e.g. `http://localhost:8080` in dev, same value the generated client uses. */
  protected get baseUrl(): string {
    return this.appConfig.apiBaseUrl;
  }

  /** Builds `{baseUrl}/api/v1/{path}`, matching the generated client's own path convention exactly. */
  protected apiUrl(path: string): string {
    const trimmed = path.startsWith('/') ? path.slice(1) : path;
    return `${this.baseUrl}/api/v1/${trimmed}`;
  }

  /** Normalizes any failure the same way a generated service's caller would see it. */
  protected normalizeErrors<T>(source$: Observable<T>): Observable<T> {
    return source$.pipe(
      catchError((error: unknown) => throwError(() => toUmsApiError(error) satisfies UmsApiError)),
    );
  }
}
