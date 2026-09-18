import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type {
  ConfirmLectureMaterialUploadRequest,
  CreateLectureMaterialRequest,
  LectureMaterialDto,
  LectureMaterialUploadSlotDto,
  PublishLectureMaterialVersionRequest,
  RequestLectureMaterialUploadRequest,
} from './learning.types';

/**
 * Interim client for the `Learning` module's LectureMaterial endpoints (FWEB-22/FWEB-23). Each
 * method's own doc comment names the exact route verified against `ums-core`'s
 * `UMS.Modules.Learning.Api.Endpoints.LectureMaterialEndpoints` source.
 */
@Injectable({ providedIn: 'root' })
export class LearningApi extends ProvisionalModuleApiBase {
  /** `GET /api/v1/learning/course-offerings/{id}/lecture-materials?lang=` (confirmed) -- enrollment/instructor-scoped, ordered by (moduleGroup, sortOrder) server-side. */
  listMaterials(courseOfferingId: string, lang?: string): Observable<LectureMaterialDto[]> {
    let params = new HttpParams();
    if (lang) {
      params = params.set('lang', lang);
    }
    return this.normalizeErrors(
      this.http.get<LectureMaterialDto[]>(
        this.apiUrl(`learning/course-offerings/${courseOfferingId}/lecture-materials`),
        { params },
      ),
    );
  }

  /** `POST /api/v1/learning/course-offerings/{id}/lecture-materials/uploads` (confirmed, `learning.lecturematerial.manage`) -- requests a presigned upload slot for a new file/video. */
  requestUpload(
    courseOfferingId: string,
    request: RequestLectureMaterialUploadRequest,
  ): Observable<LectureMaterialUploadSlotDto> {
    return this.normalizeErrors(
      this.http.post<LectureMaterialUploadSlotDto>(
        this.apiUrl(`learning/course-offerings/${courseOfferingId}/lecture-materials/uploads`),
        request,
      ),
    );
  }

  /** `POST /api/v1/learning/course-offerings/{id}/lecture-materials/uploads/confirm` (confirmed) -- call once the presigned PUT to `uploadUrl` has completed. */
  confirmUpload(
    courseOfferingId: string,
    request: ConfirmLectureMaterialUploadRequest,
  ): Observable<LectureMaterialUploadSlotDto> {
    return this.normalizeErrors(
      this.http.post<LectureMaterialUploadSlotDto>(
        this.apiUrl(
          `learning/course-offerings/${courseOfferingId}/lecture-materials/uploads/confirm`,
        ),
        request,
      ),
    );
  }

  /** `POST /api/v1/learning/course-offerings/{id}/lecture-materials` (confirmed) -- creates a brand-new LectureMaterial with its first version. */
  createMaterial(
    courseOfferingId: string,
    request: CreateLectureMaterialRequest,
  ): Observable<LectureMaterialDto> {
    return this.normalizeErrors(
      this.http.post<LectureMaterialDto>(
        this.apiUrl(`learning/course-offerings/${courseOfferingId}/lecture-materials`),
        request,
      ),
    );
  }

  /** `POST /api/v1/learning/lecture-materials/{id}/versions` (confirmed) -- FWEB-22's "replacing a file creates a NEW version, never a silent overwrite": this is that call, append-only server-side by construction (`LectureMaterialVersion` has no mutating method at all). */
  publishVersion(
    lectureMaterialId: string,
    request: PublishLectureMaterialVersionRequest,
  ): Observable<LectureMaterialDto> {
    return this.normalizeErrors(
      this.http.post<LectureMaterialDto>(
        this.apiUrl(`learning/lecture-materials/${lectureMaterialId}/versions`),
        request,
      ),
    );
  }
}
