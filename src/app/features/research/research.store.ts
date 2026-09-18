import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { FacultyApi } from '../../core/api/faculty.api';
import { FacultyIdentityService } from '../../core/auth/faculty-identity.service';
import { mergeServerAndDrafts, toDraftsFromServer, toPublicationDtos } from './research-visibility';
import type { PublicationDraft } from './research.types';

function storageKey(facultyMemberId: string): string {
  return `fweb.research.drafts.${facultyMemberId}`;
}

/**
 * ResearchProfile feature store (FWEB-27/FWEB-28) -- the single source of truth also surfaced on
 * `ums-public-web`'s faculty directory (they read the exact same `GET .../research-profile`
 * endpoint this store does). Edits here are never duplicated/re-entered elsewhere.
 *
 * See `research-visibility.ts`'s own doc for FWEB-28's per-publication visibility mechanism: a
 * `'draft'`-visibility entry is simply never included in the PUT body, so it can never appear on
 * the public directory mid-edit -- the entire mechanism lives client-side because `PublicationDto`
 * has no server-side visibility field at all (confirmed gap). Draft entries persist to
 * `localStorage` (never the server) so they survive a reload on the SAME device.
 */
@Injectable({ providedIn: 'root' })
export class ResearchStore {
  private readonly facultyApi = inject(FacultyApi);
  private readonly facultyIdentity = inject(FacultyIdentityService);
  private readonly document = inject(DOCUMENT);

  private readonly facultyMemberIdState = signal<string | null>(null);
  private readonly publicationsState = signal<readonly PublicationDraft[]>([]);
  private readonly ongoingResearchState = signal('');
  private readonly grantsState = signal('');
  private readonly versionState = signal(0);
  private readonly isLoadingState = signal(false);
  private readonly isSavingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly publications = this.publicationsState.asReadonly();
  readonly ongoingResearch = this.ongoingResearchState.asReadonly();
  readonly grants = this.grantsState.asReadonly();
  readonly isLoading = this.isLoadingState.asReadonly();
  readonly isSaving = this.isSavingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly publicPublications = computed(() =>
    this.publications().filter((p) => p.visibility === 'public'),
  );
  readonly draftPublications = computed(() =>
    this.publications().filter((p) => p.visibility === 'draft'),
  );

  load(): void {
    const facultyMemberId = this.facultyIdentity.facultyMemberId();
    this.facultyMemberIdState.set(facultyMemberId);
    if (!facultyMemberId) {
      this.errorState.set('research.error.noFacultyMember');
      return;
    }

    this.isLoadingState.set(true);
    this.errorState.set(null);
    this.facultyApi.getResearchProfile(facultyMemberId).subscribe({
      next: (dto) => {
        const serverDrafts = toDraftsFromServer(dto.publications);
        const localDrafts = this.readLocalDrafts(facultyMemberId);
        this.publicationsState.set(mergeServerAndDrafts(serverDrafts, localDrafts));
        this.ongoingResearchState.set(dto.ongoingResearch ?? '');
        this.grantsState.set(dto.grants ?? '');
        this.versionState.set(dto.version);
        this.isLoadingState.set(false);
      },
      error: () => {
        this.errorState.set('research.error.loadFailed');
        this.isLoadingState.set(false);
      },
    });
  }

  /** A new entry always starts as `'draft'` -- it is never sent to the server (never public) until explicitly toggled and saved. */
  addPublication(entry: {
    readonly title: string;
    readonly venue: string;
    readonly year: number;
    readonly url: string | null;
  }): void {
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.publicationsState.update((list) => [...list, { localId, ...entry, visibility: 'draft' }]);
    this.persistDrafts();
  }

  updatePublication(localId: string, patch: Partial<Omit<PublicationDraft, 'localId'>>): void {
    this.publicationsState.update((list) =>
      list.map((p) => (p.localId === localId ? { ...p, ...patch } : p)),
    );
    this.persistDrafts();
  }

  removePublication(localId: string): void {
    this.publicationsState.update((list) => list.filter((p) => p.localId !== localId));
    this.persistDrafts();
  }

  /** FWEB-28's toggle -- flips between draft (never sent) and public (included in the next save). */
  toggleVisibility(localId: string): void {
    this.publicationsState.update((list) =>
      list.map((p) =>
        p.localId === localId
          ? { ...p, visibility: p.visibility === 'public' ? 'draft' : 'public' }
          : p,
      ),
    );
    this.persistDrafts();
  }

  setOngoingResearch(value: string): void {
    this.ongoingResearchState.set(value);
  }

  setGrants(value: string): void {
    this.grantsState.set(value);
  }

  /** Sends only currently-public-visibility publications (FWEB-28's core mechanism). */
  save(): void {
    const facultyMemberId = this.facultyMemberIdState();
    if (!facultyMemberId) {
      return;
    }
    this.isSavingState.set(true);
    this.errorState.set(null);
    this.facultyApi
      .updateResearchProfile(facultyMemberId, {
        publications: toPublicationDtos(this.publications()),
        ongoingResearch: this.ongoingResearchState().trim() || null,
        grants: this.grantsState().trim() || null,
        version: this.versionState(),
      })
      .subscribe({
        next: (dto) => {
          this.versionState.set(dto.version);
          this.isSavingState.set(false);
          this.persistDrafts();
        },
        error: () => {
          this.errorState.set('research.error.saveFailed');
          this.isSavingState.set(false);
        },
      });
  }

  private readLocalDrafts(facultyMemberId: string): readonly PublicationDraft[] {
    try {
      const raw = this.document.defaultView?.localStorage.getItem(storageKey(facultyMemberId));
      return raw ? (JSON.parse(raw) as PublicationDraft[]) : [];
    } catch {
      return [];
    }
  }

  private persistDrafts(): void {
    const facultyMemberId = this.facultyMemberIdState();
    if (!facultyMemberId) {
      return;
    }
    try {
      this.document.defaultView?.localStorage.setItem(
        storageKey(facultyMemberId),
        JSON.stringify(this.draftPublications()),
      );
    } catch {
      // Storage unavailable -- the draft still exists in memory for this tab's life.
    }
  }
}
