import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { FacultyApi } from '../../core/api/faculty.api';
import type { ResearchProfileDto } from '../../core/api/faculty.types';
import { FacultyIdentityService } from '../../core/auth/faculty-identity.service';
import { ResearchStore } from './research.store';

describe('ResearchStore', () => {
  let facultyApiSpy: jasmine.SpyObj<FacultyApi>;
  let store: ResearchStore;

  function profile(overrides: Partial<ResearchProfileDto> = {}): ResearchProfileDto {
    return {
      id: 'rp-1',
      facultyMemberId: 'fac-1',
      publications: [],
      ongoingResearch: null,
      grants: null,
      version: 1,
      ...overrides,
    };
  }

  beforeEach(() => {
    facultyApiSpy = jasmine.createSpyObj('FacultyApi', [
      'getResearchProfile',
      'updateResearchProfile',
    ]);
    TestBed.configureTestingModule({
      providers: [
        { provide: FacultyApi, useValue: facultyApiSpy },
        { provide: FacultyIdentityService, useValue: { facultyMemberId: signal('fac-1') } },
      ],
    });
    store = TestBed.inject(ResearchStore);
    TestBed.inject(DOCUMENT).defaultView?.localStorage.removeItem('fweb.research.drafts.fac-1');
  });

  it('load populates publications, ongoing research, and grants from the server', () => {
    facultyApiSpy.getResearchProfile.and.returnValue(
      of(
        profile({
          publications: [{ title: 'Paper A', venue: 'J', year: 2024, url: null }],
          ongoingResearch: 'ML',
          grants: 'NSF',
        }),
      ),
    );
    store.load();
    expect(store.publications().length).toBe(1);
    expect(store.publications()[0].visibility).toBe('public');
    expect(store.ongoingResearch()).toBe('ML');
    expect(store.grants()).toBe('NSF');
  });

  it('a newly-added publication starts as draft, never sent until toggled public', () => {
    facultyApiSpy.getResearchProfile.and.returnValue(of(profile()));
    store.load();

    store.addPublication({ title: 'In progress', venue: 'J2', year: 2026, url: null });

    expect(store.draftPublications().length).toBe(1);
    expect(store.publicPublications().length).toBe(0);

    facultyApiSpy.updateResearchProfile.and.returnValue(of(profile({ version: 2 })));
    store.save();
    expect(facultyApiSpy.updateResearchProfile).toHaveBeenCalledWith(
      'fac-1',
      jasmine.objectContaining({ publications: [] }),
    );
  });

  it('toggling a draft to public includes it in the next save -- FWEB-28', () => {
    facultyApiSpy.getResearchProfile.and.returnValue(of(profile()));
    store.load();
    store.addPublication({ title: 'Now ready', venue: 'J3', year: 2026, url: null });
    const localId = store.publications()[0].localId;

    store.toggleVisibility(localId);
    expect(store.publicPublications().length).toBe(1);

    facultyApiSpy.updateResearchProfile.and.returnValue(of(profile({ version: 2 })));
    store.save();

    expect(facultyApiSpy.updateResearchProfile).toHaveBeenCalledWith(
      'fac-1',
      jasmine.objectContaining({
        publications: [{ title: 'Now ready', venue: 'J3', year: 2026, url: null }],
      }),
    );
  });

  it('a draft entry survives a reload on the same device via localStorage', () => {
    facultyApiSpy.getResearchProfile.and.returnValue(of(profile()));
    store.load();
    store.addPublication({ title: 'Persisted draft', venue: 'J', year: 2026, url: null });

    // Simulate a fresh load.
    store.load();

    expect(store.draftPublications().some((p) => p.title === 'Persisted draft')).toBe(true);
  });

  it('removePublication drops an entry entirely', () => {
    facultyApiSpy.getResearchProfile.and.returnValue(of(profile()));
    store.load();
    store.addPublication({ title: 'To remove', venue: 'J', year: 2026, url: null });
    const localId = store.publications()[0].localId;

    store.removePublication(localId);

    expect(store.publications().length).toBe(0);
  });

  it('save surfaces an error without losing local state', () => {
    facultyApiSpy.getResearchProfile.and.returnValue(of(profile()));
    store.load();
    facultyApiSpy.updateResearchProfile.and.returnValue(throwError(() => new Error('server down')));

    store.save();

    expect(store.error()).toBe('research.error.saveFailed');
  });

  it('load surfaces an error when the FacultyMember id cannot be resolved', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FacultyApi, useValue: facultyApiSpy },
        { provide: FacultyIdentityService, useValue: { facultyMemberId: signal(null) } },
      ],
    });
    const freshStore = TestBed.inject(ResearchStore);
    freshStore.load();
    expect(freshStore.error()).toBe('research.error.noFacultyMember');
  });
});
