import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { TokenStorageService } from '@ums/shared';
import { authGuard, guestGuard } from './auth.guard';

interface MutableTokenStorage {
  isAuthenticated: () => boolean;
}

describe('authGuard / guestGuard', () => {
  let tokenStorageSpy: jasmine.SpyObj<TokenStorageService>;
  let mutable: MutableTokenStorage;
  let router: Router;

  beforeEach(() => {
    tokenStorageSpy = jasmine.createSpyObj('TokenStorageService', ['getAccessToken']);
    mutable = tokenStorageSpy as unknown as MutableTokenStorage;
    mutable.isAuthenticated = () => false;
    TestBed.configureTestingModule({
      providers: [{ provide: TokenStorageService, useValue: tokenStorageSpy }],
    });
    router = TestBed.inject(Router);
  });

  it('authGuard allows navigation when authenticated', () => {
    mutable.isAuthenticated = () => true;
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/attendance' } as never),
    );
    expect(result).toBe(true);
  });

  it('authGuard redirects to login with a returnUrl when not authenticated', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/attendance' } as never),
    ) as UrlTree;
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result)).toContain('/login');
    expect(router.serializeUrl(result)).toContain('returnUrl');
  });

  it('guestGuard allows an unauthenticated visitor to see the login screen', () => {
    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('guestGuard redirects an already-authenticated visitor away from login', () => {
    mutable.isAuthenticated = () => true;
    const result = TestBed.runInInjectionContext(() =>
      guestGuard({} as never, {} as never),
    ) as UrlTree;
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result)).toContain('/dashboard');
  });
});
