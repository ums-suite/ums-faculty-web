import { of } from 'rxjs';
import { shortPoll } from './short-poll';

describe('shortPoll', () => {
  it('emits the first value immediately without waiting a full interval', (done) => {
    const values: number[] = [];
    const sub = shortPoll(() => of(1), 10_000).subscribe((v) => {
      values.push(v);
      sub.unsubscribe();
      expect(values).toEqual([1]);
      done();
    });
  });
});
