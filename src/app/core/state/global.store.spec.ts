import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CurrentUserService, LocaleService } from '@ums/shared';
import { ThemeService } from '@ums/design-system';
import { FacultyIdentityService } from '../auth/faculty-identity.service';
import { NotificationChannelService } from '../realtime/notification-channel.service';
import { GlobalStore } from './global.store';

describe('GlobalStore', () => {
  let store: GlobalStore;
  let currentUserSpy: jasmine.SpyObj<CurrentUserService>;
  let localeServiceSpy: { locale: ReturnType<typeof signal>; setLocale: jasmine.Spy };
  let themeServiceSpy: {
    mode: ReturnType<typeof signal>;
    resolvedTheme: ReturnType<typeof signal>;
    setMode: jasmine.Spy;
  };
  let notificationChannelSpy: jasmine.SpyObj<NotificationChannelService>;

  beforeEach(() => {
    currentUserSpy = jasmine.createSpyObj('CurrentUserService', ['hasRole'], {
      userId: signal('user-1'),
      roles: signal(['FacultyMember']),
    });
    localeServiceSpy = { locale: signal('en'), setLocale: jasmine.createSpy('setLocale') };
    themeServiceSpy = {
      mode: signal('system'),
      resolvedTheme: signal('light'),
      setMode: jasmine.createSpy('setMode'),
    };
    notificationChannelSpy = jasmine.createSpyObj(
      'NotificationChannelService',
      ['connect', 'disconnect'],
      { unreadCount: signal(2), connected: signal(true) },
    );

    TestBed.configureTestingModule({
      providers: [
        { provide: CurrentUserService, useValue: currentUserSpy },
        { provide: LocaleService, useValue: localeServiceSpy },
        { provide: ThemeService, useValue: themeServiceSpy },
        {
          provide: FacultyIdentityService,
          useValue: { facultyMemberId: signal('fac-1') },
        },
        { provide: NotificationChannelService, useValue: notificationChannelSpy },
      ],
    });
    store = TestBed.inject(GlobalStore);
  });

  it('exposes session/locale/theme/notification state', () => {
    expect(store.userId()).toBe('user-1');
    expect(store.facultyMemberId()).toBe('fac-1');
    expect(store.locale()).toBe('en');
    expect(store.themeMode()).toBe('system');
    expect(store.unreadNotificationCount()).toBe(2);
    expect(store.notificationChannelConnected()).toBe(true);
  });

  it('isDepartmentHead delegates to CurrentUserService.hasRole', () => {
    currentUserSpy.hasRole.and.returnValue(true);
    expect(store.isDepartmentHead()).toBe(true);
    expect(currentUserSpy.hasRole).toHaveBeenCalledWith('DepartmentHead');
  });

  it('setLocale delegates to LocaleService', () => {
    store.setLocale('bn');
    expect(localeServiceSpy.setLocale).toHaveBeenCalledWith('bn');
  });

  it('setThemeMode delegates to ThemeService', () => {
    store.setThemeMode('dark');
    expect(themeServiceSpy.setMode).toHaveBeenCalledWith('dark');
  });

  it('connect/disconnectNotifications delegate to NotificationChannelService', () => {
    store.connectNotifications();
    store.disconnectNotifications();
    expect(notificationChannelSpy.connect).toHaveBeenCalled();
    expect(notificationChannelSpy.disconnect).toHaveBeenCalled();
  });
});
