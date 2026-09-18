import type { PublicationDto } from '../../core/api/faculty.types';
import type { PublicationDraft } from './research.types';

/**
 * Pure helpers for FWEB-28's per-publication visibility toggle. Kept Angular/HTTP-free so the
 * "an in-progress edit never appears on the public directory mid-edit" guarantee is trivially
 * unit-testable independent of `ResearchStore`'s own HTTP orchestration.
 *
 * See `faculty.types.ts`'s `PublicationDto` doc for the confirmed gap this resolves around: there
 * is no server-side draft/public field at all, so the mechanism is purely about WHAT gets included
 * in the next PUT body, never a flag sent to the server.
 */

/** Every server-sourced publication is, by construction, already public (it came back from the public GET) -- assigns a stable localId for list rendering/editing. */
export function toDraftsFromServer(
  publications: readonly PublicationDto[],
): readonly PublicationDraft[] {
  return publications.map((p, index) => ({
    localId: `server-${index}-${p.title}`,
    title: p.title,
    venue: p.venue,
    year: p.year,
    url: p.url,
    visibility: 'public' as const,
  }));
}

/** Only a `'public'`-visibility entry is ever sent to the server -- a `'draft'` entry is never included, which is the entire mechanism (invariant: never appears on the public directory mid-edit). */
export function toPublicationDtos(drafts: readonly PublicationDraft[]): readonly PublicationDto[] {
  return drafts
    .filter((d) => d.visibility === 'public')
    .map((d) => ({ title: d.title, venue: d.venue, year: d.year, url: d.url }));
}

/**
 * Merges the authoritative server-sourced (always-public) list with locally-persisted draft
 * entries, de-duplicating by `localId` so a draft that was just saved (and is now also present in
 * the server list) doesn't appear twice.
 */
export function mergeServerAndDrafts(
  serverDrafts: readonly PublicationDraft[],
  localDrafts: readonly PublicationDraft[],
): readonly PublicationDraft[] {
  const draftOnly = localDrafts.filter((d) => d.visibility === 'draft');
  return [...serverDrafts, ...draftOnly];
}
