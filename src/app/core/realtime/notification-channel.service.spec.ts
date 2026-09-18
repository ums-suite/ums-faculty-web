import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { APP_CONFIG, DEFAULT_APP_CONFIG } from '../config/app-config';
import { NotificationsApi } from '../api/notifications.api';
import { NotificationChannelService } from './notification-channel.service';

describe('NotificationChannelService', () => {
  let notificationsApiSpy: jasmine.SpyObj<NotificationsApi>;
  let service: NotificationChannelService;

  beforeEach(() => {
    jasmine.clock().install();
    notificationsApiSpy = jasmine.createSpyObj('NotificationsApi', ['getUnreadCount']);
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationsApi, useValue: notificationsApiSpy },
        {
          provide: APP_CONFIG,
          useValue: { ...DEFAULT_APP_CONFIG, notificationPollIntervalMs: 1000 },
        },
      ],
    });
    service = TestBed.inject(NotificationChannelService);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('polls immediately on connect and sets the unread count', () => {
    notificationsApiSpy.getUnreadCount.and.returnValue(of({ unreadCount: 4 }));
    service.connect();
    jasmine.clock().tick(0);
    expect(service.unreadCount()).toBe(4);
    expect(service.connected()).toBe(true);
  });

  it('does not open a second poll loop on a second connect() call', () => {
    notificationsApiSpy.getUnreadCount.and.returnValue(of({ unreadCount: 1 }));
    service.connect();
    jasmine.clock().tick(0);
    service.connect();
    jasmine.clock().tick(1000);
    expect(notificationsApiSpy.getUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('marks disconnected on a poll error without throwing', () => {
    notificationsApiSpy.getUnreadCount.and.returnValue(throwError(() => new Error('offline')));
    service.connect();
    jasmine.clock().tick(0);
    expect(service.connected()).toBe(false);
  });

  it('clearUnread resets the count to zero', () => {
    notificationsApiSpy.getUnreadCount.and.returnValue(of({ unreadCount: 7 }));
    service.connect();
    jasmine.clock().tick(0);
    service.clearUnread();
    expect(service.unreadCount()).toBe(0);
  });

  it('disconnect stops the poll loop', () => {
    notificationsApiSpy.getUnreadCount.and.returnValue(of({ unreadCount: 1 }));
    service.connect();
    jasmine.clock().tick(0);
    service.disconnect();
    expect(service.connected()).toBe(false);
    jasmine.clock().tick(5000);
    expect(notificationsApiSpy.getUnreadCount).toHaveBeenCalledTimes(1);
  });
});
