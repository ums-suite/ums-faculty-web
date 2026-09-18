import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { CurrentUserService } from '@ums/shared';
import { facultyGuard } from './faculty.guard';

describe('facultyGuard', () => {
  let currentUserSpy: jasmine.SpyObj<CurrentUserService>;
  let router: Router;

  beforeEach(() => {
    currentUserSpy = jasmine.createSpyObj('CurrentUserService', ['hasAnyRole']);
    TestBed.configureTestingModule({
      providers: [{ provide: CurrentUserService, useValue: currentUserSpy }],
    });
    router = TestBed.inject(Router);
  });

  it('allows a FacultyMember/DepartmentHead role through', () => {
    currentUserSpy.hasAnyRole.and.returnValue(true);
    const result = TestBed.runInInjectionContext(() => facultyGuard({} as never, {} as never));
    expect(result).toBe(true);
    expect(currentUserSpy.hasAnyRole).toHaveBeenCalledWith(['FacultyMember', 'DepartmentHead']);
  });

  it('redirects to login when the caller has neither role', () => {
    currentUserSpy.hasAnyRole.and.returnValue(false);
    const result = TestBed.runInInjectionContext(() =>
      facultyGuard({} as never, {} as never),
    ) as UrlTree;
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result)).toContain('/login');
  });
});
