import { mergeServerAndDrafts, toDraftsFromServer, toPublicationDtos } from './research-visibility';
import type { PublicationDraft } from './research.types';

describe('toDraftsFromServer', () => {
  it('marks every server-sourced entry as public', () => {
    const drafts = toDraftsFromServer([
      { title: 'Paper A', venue: 'Journal X', year: 2024, url: null },
    ]);
    expect(drafts.length).toBe(1);
    expect(drafts[0].visibility).toBe('public');
  });
});

describe('toPublicationDtos', () => {
  const draft = (overrides: Partial<PublicationDraft> = {}): PublicationDraft => ({
    localId: 'x',
    title: 'Paper',
    venue: 'Journal',
    year: 2024,
    url: null,
    visibility: 'public',
    ...overrides,
  });

  it('includes only public-visibility entries -- a draft entry never appears in the PUT body', () => {
    const dtos = toPublicationDtos([
      draft({ visibility: 'public', title: 'Public one' }),
      draft({ visibility: 'draft', title: 'Draft one' }),
    ]);
    expect(dtos).toEqual([{ title: 'Public one', venue: 'Journal', year: 2024, url: null }]);
  });

  it('returns an empty array when everything is still draft', () => {
    expect(toPublicationDtos([draft({ visibility: 'draft' })])).toEqual([]);
  });
});

describe('mergeServerAndDrafts', () => {
  it('combines server (public) entries with local draft-only entries', () => {
    const serverDrafts: PublicationDraft[] = [
      {
        localId: 'server-0',
        title: 'Published paper',
        venue: 'J',
        year: 2023,
        url: null,
        visibility: 'public',
      },
    ];
    const localDrafts: PublicationDraft[] = [
      {
        localId: 'local-1',
        title: 'In progress',
        venue: 'J2',
        year: 2026,
        url: null,
        visibility: 'draft',
      },
    ];
    const merged = mergeServerAndDrafts(serverDrafts, localDrafts);
    expect(merged.map((d) => d.title)).toEqual(['Published paper', 'In progress']);
  });

  it('never duplicates a locally-held entry that has already been marked public (it is now only in the server list)', () => {
    const serverDrafts: PublicationDraft[] = [
      {
        localId: 'server-0',
        title: 'Now public',
        venue: 'J',
        year: 2023,
        url: null,
        visibility: 'public',
      },
    ];
    const localDrafts: PublicationDraft[] = [
      {
        localId: 'server-0',
        title: 'Now public',
        venue: 'J',
        year: 2023,
        url: null,
        visibility: 'public',
      },
    ];
    const merged = mergeServerAndDrafts(serverDrafts, localDrafts);
    expect(merged.length).toBe(1);
  });
});
