import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideApi, TokenStorageService } from '@ums/shared';
import { AuthService } from './auth.service';
import { DeviceTrustService } from './device-trust.service';
import { FacultyIdentityService } from './faculty-identity.service';

const tokenPair = {
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-01-01T00:15:00Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2026-01-08T00:00:00Z',
  sessionId: 'session-1',
};

describe('AuthService', () => {
  let service: AuthService;
  let tokenStorage: TokenStorageService;
  let httpMock: HttpTestingController;
  let deviceTrustSpy: jasmine.SpyObj<DeviceTrustService>;
  let facultyIdentitySpy: jasmine.SpyObj<FacultyIdentityService>;

  beforeEach(() => {
    localStorage.clear();
    deviceTrustSpy = jasmine.createSpyObj('DeviceTrustService', ['setIsPersonalDevice', 'clear']);
    facultyIdentitySpy = jasmine.createSpyObj('FacultyIdentityService', ['clear']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi('http://localhost:8080'),
        { provide: DeviceTrustService, useValue: deviceTrustSpy },
        { provide: FacultyIdentityService, useValue: facultyIdentitySpy },
      ],
    });
    TestBed.inject(HttpClient);
    service = TestBed.inject(AuthService);
    tokenStorage = TestBed.inject(TokenStorageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('stores the token pair and records the personal-device answer on a successful login', () => {
    service.login('jdoe', 'correct-horse', true).subscribe();
    httpMock.expectOne('http://localhost:8080/api/v1/identity/auth/login').flush(tokenPair);

    expect(tokenStorage.isAuthenticated()).toBeTrue();
    expect(tokenStorage.getAccessToken()).toBe('access-1');
    expect(deviceTrustSpy.setIsPersonalDevice).toHaveBeenCalledWith(true);
  });

  it('does not touch device-trust when isPersonalDevice is omitted', () => {
    service.login('jdoe', 'correct-horse').subscribe();
    httpMock.expectOne('http://localhost:8080/api/v1/identity/auth/login').flush(tokenPair);

    expect(deviceTrustSpy.setIsPersonalDevice).not.toHaveBeenCalled();
  });

  it('clears local session (tokens + device trust + faculty identity) on successful logout', () => {
    tokenStorage.setTokens(tokenPair);

    service.logout().subscribe();
    httpMock.expectOne('http://localhost:8080/api/v1/identity/auth/logout').flush({});

    expect(tokenStorage.isAuthenticated()).toBeFalse();
    expect(deviceTrustSpy.clear).toHaveBeenCalled();
    expect(facultyIdentitySpy.clear).toHaveBeenCalled();
  });

  it('still clears local session when the logout call itself fails', () => {
    tokenStorage.setTokens(tokenPair);

    service.logout().subscribe({ error: () => undefined });
    httpMock
      .expectOne('http://localhost:8080/api/v1/identity/auth/logout')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(tokenStorage.isAuthenticated()).toBeFalse();
    expect(deviceTrustSpy.clear).toHaveBeenCalled();
    expect(facultyIdentitySpy.clear).toHaveBeenCalled();
  });

  it('clears local session on logoutAll', () => {
    tokenStorage.setTokens(tokenPair);

    service.logoutAll().subscribe();
    httpMock.expectOne('http://localhost:8080/api/v1/identity/auth/logout-all').flush({});

    expect(tokenStorage.isAuthenticated()).toBeFalse();
    expect(deviceTrustSpy.clear).toHaveBeenCalled();
    expect(facultyIdentitySpy.clear).toHaveBeenCalled();
  });
});
