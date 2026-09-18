import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TokenStorageService } from '@ums/shared';
import { APP_CONFIG, DEFAULT_APP_CONFIG } from '../config/app-config';
import { AuthService } from './auth.service';
import { DeviceTrustService } from './device-trust.service';
import { SessionTimeoutService } from './session-timeout.service';

interface MutableTokenStorage {
  isAuthenticated: () => boolean;
}
interface MutableDeviceTrust {
  isPersonalDevice: () => boolean;
}

describe('SessionTimeoutService', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let tokenStorageSpy: jasmine.SpyObj<TokenStorageService>;
  let deviceTrustSpy: jasmine.SpyObj<DeviceTrustService>;
  let mutableTokenStorage: MutableTokenStorage;
  let mutableDeviceTrust: MutableDeviceTrust;

  beforeEach(() => {
    jasmine.clock().install();
    authServiceSpy = jasmine.createSpyObj('AuthService', ['logout']);
    authServiceSpy.logout.and.returnValue(of(undefined));

    tokenStorageSpy = jasmine.createSpyObj('TokenStorageService', ['getAccessToken']);
    mutableTokenStorage = tokenStorageSpy as unknown as MutableTokenStorage;
    mutableTokenStorage.isAuthenticated = () => true;

    deviceTrustSpy = jasmine.createSpyObj('DeviceTrustService', ['setIsPersonalDevice']);
    mutableDeviceTrust = deviceTrustSpy as unknown as MutableDeviceTrust;
    mutableDeviceTrust.isPersonalDevice = () => false;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: TokenStorageService, useValue: tokenStorageSpy },
        { provide: DeviceTrustService, useValue: deviceTrustSpy },
        {
          provide: APP_CONFIG,
          useValue: {
            ...DEFAULT_APP_CONFIG,
            sharedDeviceSessionTimeoutMs: 1000,
            personalDeviceSessionTimeoutMs: 5000,
          },
        },
      ],
    });
  });

  afterEach(() => jasmine.clock().uninstall());

  it('logs out after the shared-device timeout elapses with no activity', () => {
    TestBed.inject(SessionTimeoutService);
    jasmine.clock().tick(1001);
    expect(authServiceSpy.logout).toHaveBeenCalled();
  });

  it('uses the longer personal-device timeout when the device is identified as personal', () => {
    mutableDeviceTrust.isPersonalDevice = () => true;
    TestBed.inject(SessionTimeoutService);

    jasmine.clock().tick(1001);
    expect(authServiceSpy.logout).not.toHaveBeenCalled();

    jasmine.clock().tick(4000);
    expect(authServiceSpy.logout).toHaveBeenCalled();
  });

  it('resets the idle timer on real user activity', () => {
    TestBed.inject(SessionTimeoutService);
    jasmine.clock().tick(600);
    window.dispatchEvent(new Event('keydown'));
    jasmine.clock().tick(600);
    expect(authServiceSpy.logout).not.toHaveBeenCalled();
    jasmine.clock().tick(500);
    expect(authServiceSpy.logout).toHaveBeenCalled();
  });

  it('does not schedule a timeout when not authenticated', () => {
    mutableTokenStorage.isAuthenticated = () => false;
    TestBed.inject(SessionTimeoutService);
    jasmine.clock().tick(2000);
    expect(authServiceSpy.logout).not.toHaveBeenCalled();
  });
});
