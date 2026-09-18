import { Observable, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

/**
 * A short-poll utility (FWEB-8). Deliberately just `timer` + `switchMap` -- a lightweight poll
 * loop is simpler and cheaper to get right than a push channel scoped to this app's actual
 * freshness need (requirement-spec.md §2's own reasoning). `switchMap` (not `concatMap`/
 * `mergeMap`) means a slow-to-respond poll tick is abandoned rather than queued the instant the
 * next interval fires, so the poll never falls progressively behind real time under load.
 *
 * Fires immediately (`timer(0, ...)`) so the very first render doesn't wait a full interval for
 * its first value, then repeats every `intervalMs`. The caller controls the poll's lifetime by
 * unsubscribing.
 */
export function shortPoll<T>(source: () => Observable<T>, intervalMs: number): Observable<T> {
  return timer(0, intervalMs).pipe(switchMap(() => source()));
}
