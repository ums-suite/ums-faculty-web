export type PublicationVisibility = 'draft' | 'public';

/** FWEB-27/FWEB-28 domain type -- an editable working copy of one publication entry, carrying a client-only {@link PublicationVisibility} not present in the real `PublicationDto` (confirmed backend gap, `faculty.types.ts`'s own doc comment). */
export interface PublicationDraft {
  readonly localId: string;
  readonly title: string;
  readonly venue: string;
  readonly year: number;
  readonly url: string | null;
  readonly visibility: PublicationVisibility;
}
