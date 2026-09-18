import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

/**
 * A single presigned-URL direct-to-object-storage PUT (ADR-0010's platform-wide upload pattern --
 * `Documents`/`Learning` both issue a presigned URL via an artifact-upload-request call, then
 * expect the caller to PUT the raw file bytes straight to that URL, then confirm). Deliberately a
 * plain function taking an injected `HttpClient` rather than its own service: `uploadUrl` targets
 * a different origin than `ums-core`'s own API base, and `@ums/shared`'s `authInterceptor` already
 * correctly skips attaching the bearer token to any request whose origin doesn't match
 * `UMS_AUTH_CONFIG.baseUrl` (fixed platform-wide, see `project_ums_frontend_gotchas.md`) -- so a
 * plain `HttpClient.put` call here needs no special bypass of its own.
 *
 * Reports 0-100 upload progress via `HttpEventType.UploadProgress`, matching
 * `UploadableFile.progress`'s own 0-100 contract (`@ums/design-system`).
 */
export function putFileToPresignedUrl(
  http: HttpClient,
  uploadUrl: string,
  file: File,
): Observable<number> {
  return http
    .put(uploadUrl, file, {
      reportProgress: true,
      observe: 'events',
      headers: file.type ? { 'Content-Type': file.type } : undefined,
    })
    .pipe(
      filter(
        (event) =>
          event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response,
      ),
      map((event) => {
        if (event.type === HttpEventType.Response) {
          return 100;
        }
        const total = event.total ?? file.size;
        return total > 0 ? Math.round((event.loaded / total) * 100) : 0;
      }),
    );
}
