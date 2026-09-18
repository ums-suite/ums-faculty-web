import { TestBed } from '@angular/core/testing';
import { TranslatePipe } from './translate.pipe';
import { TranslationService } from './translation.service';

describe('TranslatePipe', () => {
  it('delegates to TranslationService.t()', () => {
    const translationServiceSpy = jasmine.createSpyObj<TranslationService>('TranslationService', [
      't',
    ]);
    translationServiceSpy.t.and.returnValue('translated');

    TestBed.configureTestingModule({
      providers: [{ provide: TranslationService, useValue: translationServiceSpy }],
    });

    const pipe = TestBed.runInInjectionContext(() => new TranslatePipe());

    expect(pipe.transform('some.key', { a: 1 })).toBe('translated');
    expect(translationServiceSpy.t).toHaveBeenCalledWith('some.key', { a: 1 });
  });
});
