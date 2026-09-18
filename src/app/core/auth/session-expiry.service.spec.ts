import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { TokenStorageService } from '@ums/shared';
import { SessionExpiryService } from './session-expiry.service';

describe('SessionExpiryService', () => {
  it('navigates to login with a returnUrl when sessionExpired$ fires', () => {
    const sessionExpired$ = new Subject<void>();
    const tokenStorageSpy = { sessionExpired$ } as unknown as TokenStorageService;

    TestBed.configureTestingModule({
      providers: [{ provide: TokenStorageService, useValue: tokenStorageSpy }],
    });

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    Object.defineProperty(router, 'url', { value: '/attendance/roster', configurable: true });

    TestBed.inject(SessionExpiryService);
    sessionExpired$.next();

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/attendance/roster' },
    });
  });
});
