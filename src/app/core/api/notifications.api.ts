import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type { InAppNotificationDto, UnreadCountDto } from './notifications.types';

/**
 * Interim client for `Notifications` module's in-app notification center (FWEB-5/FWEB-8). Routes
 * confirmed against `ums-core`'s `NotificationCenterEndpoints.cs` (`group.MapGroup("/me")` under
 * the module's `/api/v1/notifications` root, matching Identity/Academic's own `/api/v1/{module}`
 * mount convention).
 */
@Injectable({ providedIn: 'root' })
export class NotificationsApi extends ProvisionalModuleApiBase {
  /** `GET /api/v1/notifications/me/unread-count` (confirmed) -- the badge poll's own payload (FWEB-8). */
  getUnreadCount(): Observable<UnreadCountDto> {
    return this.normalizeErrors(
      this.http.get<UnreadCountDto>(this.apiUrl('notifications/me/unread-count')),
    );
  }

  /** `GET /api/v1/notifications/me?skip=&take=` (confirmed). */
  listMyNotifications(skip = 0, take = 20): Observable<InAppNotificationDto[]> {
    const params = new HttpParams().set('skip', skip).set('take', take);
    return this.normalizeErrors(
      this.http.get<InAppNotificationDto[]>(this.apiUrl('notifications/me'), { params }),
    );
  }

  /** `PATCH /api/v1/notifications/me/{id}/read` (confirmed). */
  markRead(id: string): Observable<void> {
    return this.normalizeErrors(
      this.http.patch(this.apiUrl(`notifications/me/${id}/read`), {}),
    ) as unknown as Observable<void>;
  }

  /** `PATCH /api/v1/notifications/me/read-all` (confirmed). */
  markAllRead(): Observable<void> {
    return this.normalizeErrors(
      this.http.patch(this.apiUrl('notifications/me/read-all'), {}),
    ) as unknown as Observable<void>;
  }
}
