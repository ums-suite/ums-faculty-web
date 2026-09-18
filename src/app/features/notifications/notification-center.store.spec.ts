import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NotificationsApi } from '../../core/api/notifications.api';
import type { InAppNotificationDto } from '../../core/api/notifications.types';
import { NotificationChannelService } from '../../core/realtime/notification-channel.service';
import { NotificationCenterStore } from './notification-center.store';

describe('NotificationCenterStore', () => {
  let notificationsApiSpy: jasmine.SpyObj<NotificationsApi>;
  let channelSpy: jasmine.SpyObj<NotificationChannelService>;
  let store: NotificationCenterStore;

  function notification(overrides: Partial<InAppNotificationDto> = {}): InAppNotificationDto {
    return {
      id: 'n-1',
      category: 'LeaveDecision',
      title: 'Leave approved',
      body: 'Your leave request was approved.',
      isRead: false,
      createdAt: '2026-09-10T00:00:00Z',
      ...overrides,
    };
  }

  beforeEach(() => {
    notificationsApiSpy = jasmine.createSpyObj('NotificationsApi', [
      'listMyNotifications',
      'markRead',
      'markAllRead',
    ]);
    channelSpy = jasmine.createSpyObj('NotificationChannelService', ['clearUnread']);
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationsApi, useValue: notificationsApiSpy },
        { provide: NotificationChannelService, useValue: channelSpy },
      ],
    });
    store = TestBed.inject(NotificationCenterStore);
  });

  it('load populates the list sorted newest-first', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(
      of([
        notification({ id: 'old', createdAt: '2026-09-01T00:00:00Z' }),
        notification({ id: 'new', createdAt: '2026-09-15T00:00:00Z' }),
      ]),
    );
    store.load();
    expect(store.notifications().map((n) => n.id)).toEqual(['new', 'old']);
  });

  it('load surfaces an error without throwing', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(throwError(() => new Error('offline')));
    store.load();
    expect(store.error()).toBe('notifications.error.loadFailed');
  });

  it('markRead flips one notification to read and clears the badge once nothing else is unread', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(of([notification()]));
    notificationsApiSpy.markRead.and.returnValue(of(undefined));
    store.load();

    store.markRead('n-1');

    expect(store.notifications()[0].isRead).toBe(true);
    expect(channelSpy.clearUnread).toHaveBeenCalled();
  });

  it('markRead does not clear the badge while other notifications remain unread', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(
      of([notification({ id: 'a' }), notification({ id: 'b' })]),
    );
    notificationsApiSpy.markRead.and.returnValue(of(undefined));
    store.load();

    store.markRead('a');

    expect(channelSpy.clearUnread).not.toHaveBeenCalled();
  });

  it('markAllRead marks every notification read and clears the badge', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(
      of([notification({ id: 'a' }), notification({ id: 'b' })]),
    );
    notificationsApiSpy.markAllRead.and.returnValue(of(undefined));
    store.load();

    store.markAllRead();

    expect(store.notifications().every((n) => n.isRead)).toBe(true);
    expect(channelSpy.clearUnread).toHaveBeenCalled();
  });

  it('hasUnread reflects the current list', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(of([notification({ isRead: true })]));
    store.load();
    expect(store.hasUnread()).toBe(false);
  });
});
