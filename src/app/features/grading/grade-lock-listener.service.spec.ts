import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NotificationsApi } from '../../core/api/notifications.api';
import type { InAppNotificationDto } from '../../core/api/notifications.types';
import {
  GRADE_LOCKED_NOTIFICATION_CATEGORY,
  GradeLockListenerService,
} from './grade-lock-listener.service';

describe('GradeLockListenerService', () => {
  let notificationsApiSpy: jasmine.SpyObj<NotificationsApi>;
  let service: GradeLockListenerService;

  function notification(overrides: Partial<InAppNotificationDto> = {}): InAppNotificationDto {
    return {
      id: 'n-1',
      category: GRADE_LOCKED_NOTIFICATION_CATEGORY,
      title: 'Grade batch locked',
      body: 'Your grade batch was locked for review.',
      isRead: false,
      createdAt: '2026-09-18T00:00:00Z',
      ...overrides,
    };
  }

  beforeEach(() => {
    jasmine.clock().install();
    notificationsApiSpy = jasmine.createSpyObj('NotificationsApi', ['listMyNotifications']);
    TestBed.configureTestingModule({
      providers: [{ provide: NotificationsApi, useValue: notificationsApiSpy }],
    });
    service = TestBed.inject(GradeLockListenerService);
  });

  afterEach(() => {
    service.stop();
    jasmine.clock().uninstall();
  });

  it('surfaces the first unread GradeLocked notification observed', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(of([notification()]));
    service.start();
    jasmine.clock().tick(0);
    expect(service.lockedNotice()?.id).toBe('n-1');
  });

  it('ignores a read notification and a non-GradeLocked category', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(
      of([
        notification({ id: 'n-read', isRead: true }),
        notification({ id: 'n-other', category: 'LeaveDecision' }),
      ]),
    );
    service.start();
    jasmine.clock().tick(0);
    expect(service.lockedNotice()).toBeNull();
  });

  it('never re-surfaces the same notification id twice', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(of([notification()]));
    service.start();
    jasmine.clock().tick(0);
    service.acknowledge();
    expect(service.lockedNotice()).toBeNull();
    // A second poll tick returning the identical notification must not resurrect it.
    (
      service as unknown as { handleNotifications: (n: readonly InAppNotificationDto[]) => void }
    ).handleNotifications([notification()]);
    expect(service.lockedNotice()).toBeNull();
  });

  it('acknowledge clears the current notice', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(of([notification()]));
    service.start();
    jasmine.clock().tick(0);
    service.acknowledge();
    expect(service.lockedNotice()).toBeNull();
  });

  it('start is idempotent -- calling it twice does not double-subscribe', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(of([notification()]));
    service.start();
    service.start();
    jasmine.clock().tick(0);
    expect(notificationsApiSpy.listMyNotifications).toHaveBeenCalledTimes(1);
  });

  it('stop clears the notice and seen-ids so a restart can observe the same notification again', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(of([notification()]));
    service.start();
    jasmine.clock().tick(0);
    service.stop();
    expect(service.lockedNotice()).toBeNull();
    service.start();
    jasmine.clock().tick(0);
    expect(service.lockedNotice()?.id).toBe('n-1');
  });

  it('a poll failure never surfaces a fake lock notice', () => {
    notificationsApiSpy.listMyNotifications.and.returnValue(
      throwError(() => new Error('network down')),
    );
    expect(() => service.start()).not.toThrow();
    jasmine.clock().tick(0);
    expect(service.lockedNotice()).toBeNull();
  });
});
