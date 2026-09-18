import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type { RequestUploadRequestBody, UploadedArtifactDto } from './documents.types';

/**
 * Interim client for `Documents`' presigned-upload flow (FWEB-24), used for a LeaveRequest's
 * supporting-document attachment. See `documents.types.ts`'s own doc comment for the confirmed
 * permission-grant gap this client is built against.
 */
@Injectable({ providedIn: 'root' })
export class DocumentsApi extends ProvisionalModuleApiBase {
  /** `POST /api/v1/documents/uploads` (confirmed, `document.document.generate`). */
  requestUpload(request: RequestUploadRequestBody): Observable<UploadedArtifactDto> {
    return this.normalizeErrors(
      this.http.post<UploadedArtifactDto>(this.apiUrl('documents/uploads'), request),
    );
  }

  /** `POST /api/v1/documents/uploads/{id}/confirm` (confirmed). */
  confirmUpload(id: string): Observable<UploadedArtifactDto> {
    return this.normalizeErrors(
      this.http.post<UploadedArtifactDto>(this.apiUrl(`documents/uploads/${id}/confirm`), {}),
    );
  }
}
