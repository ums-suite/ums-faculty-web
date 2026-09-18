import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CurrentUserService } from '@ums/shared';
import { FacultyApi } from '../api/faculty.api';
import { FacultyIdentityService } from './faculty-identity.service';

describe('FacultyIdentityService', () => {
  let facultyApiSpy: jasmine.SpyObj<FacultyApi>;
  let userIdSignal: ReturnType<typeof signal<string | null>>;

  beforeEach(() => {
    localStorage.clear();
    facultyApiSpy = jasmine.createSpyObj('FacultyApi', ['listFacultyMembers']);
    userIdSignal = signal<string | null>('user-1');
    TestBed.configureTestingModule({
      providers: [
        { provide: FacultyApi, useValue: facultyApiSpy },
        { provide: CurrentUserService, useValue: { userId: userIdSignal } },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  it('starts unresolved with no persisted id', () => {
    const service = TestBed.inject(FacultyIdentityService);
    expect(service.facultyMemberId()).toBeNull();
    expect(service.isResolved()).toBe(false);
  });

  it('persists an explicitly set FacultyMemberId', () => {
    const service = TestBed.inject(FacultyIdentityService);
    service.setFacultyMemberId('fac-1');
    expect(service.facultyMemberId()).toBe('fac-1');
    expect(service.isResolved()).toBe(true);
    expect(localStorage.getItem('fweb.faculty-identity.faculty-member-id')).toBe('fac-1');
  });

  it('clear() removes the resolved id', () => {
    const service = TestBed.inject(FacultyIdentityService);
    service.setFacultyMemberId('fac-1');
    service.clear();
    expect(service.facultyMemberId()).toBeNull();
    expect(localStorage.getItem('fweb.faculty-identity.faculty-member-id')).toBeNull();
  });

  it('resolveFromDirectory matches on userId and sets the resolved id', (done) => {
    facultyApiSpy.listFacultyMembers.and.returnValue(
      of({
        items: [
          { id: 'fac-1', userId: 'user-1' } as never,
          { id: 'fac-2', userId: 'user-2' } as never,
        ],
        totalCount: 2,
        skip: 0,
        take: 200,
      }),
    );
    const service = TestBed.inject(FacultyIdentityService);

    service.resolveFromDirectory('dept-1').subscribe((id) => {
      expect(id).toBe('fac-1');
      expect(service.facultyMemberId()).toBe('fac-1');
      done();
    });
  });

  it('resolveFromDirectory resolves null when no match is found', (done) => {
    facultyApiSpy.listFacultyMembers.and.returnValue(
      of({ items: [], totalCount: 0, skip: 0, take: 200 }),
    );
    const service = TestBed.inject(FacultyIdentityService);

    service.resolveFromDirectory().subscribe((id) => {
      expect(id).toBeNull();
      expect(service.facultyMemberId()).toBeNull();
      done();
    });
  });

  it('resolveFromDirectory resolves null immediately when there is no current userId', (done) => {
    userIdSignal.set(null);
    const service = TestBed.inject(FacultyIdentityService);

    service.resolveFromDirectory().subscribe((id) => {
      expect(id).toBeNull();
      expect(facultyApiSpy.listFacultyMembers).not.toHaveBeenCalled();
      done();
    });
  });
});
