import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG, DEFAULT_APP_CONFIG } from '../config/app-config';
import { NotificationsApi } from './notifications.api';

describe('NotificationsApi', () => {
  let api: NotificationsApi;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { ...DEFAULT_APP_CONFIG, apiBaseUrl: baseUrl } },
      ],
    });
    api = TestBed.inject(NotificationsApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('gets the unread count', () => {
    api.getUnreadCount().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/notifications/me/unread-count`);
    expect(req.request.method).toBe('GET');
    req.flush({ unreadCount: 3 });
  });

  it('lists notifications with skip/take params', () => {
    api.listMyNotifications(10, 5).subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/notifications/me` &&
        r.params.get('skip') === '10' &&
        r.params.get('take') === '5',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('marks one notification read via PATCH', () => {
    api.markRead('n-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/notifications/me/n-1/read`);
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
  });

  it('marks all notifications read via PATCH', () => {
    api.markAllRead().subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/notifications/me/read-all`);
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
  });
});
