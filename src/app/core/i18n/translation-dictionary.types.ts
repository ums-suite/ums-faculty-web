/**
 * Flat dot-path key -> string dictionary for one UI locale (e.g. `'shell.nav.dashboard'`). Flat
 * (not nested) so a missing-key check is a simple `key in dictionary` lookup, and so every
 * feature module can own its own key namespace without a shared nested-object shape to merge.
 *
 * Scope note (FWEB-3, requirement-spec.md §2 i18n row): this dictionary is for **static UI
 * chrome** only -- labels, buttons, validation messages, instructional copy (ADR-0011: "UI
 * strings, validation messages, and static template chrome are handled by standard Angular
 * i18n... not database rows"). It is deliberately NOT used for backend-sourced translated
 * *content* (course titles, notices) -- those are resolved server-side per ADR-0011/
 * ums-conventions.md and arrive already in the caller's language via `LocaleService`'s
 * `?lang=`/`Accept-Language` propagation (`localeInterceptor`, wired in `core/http`).
 */
export type TranslationDictionary = Readonly<Record<string, string>>;

/** Parameters for `{{placeholder}}` interpolation inside a translated string. */
export type TranslationParams = Readonly<Record<string, string | number>>;
