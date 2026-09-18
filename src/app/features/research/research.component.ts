import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsEmptyStateComponent,
  UmsInputComponent,
  UmsTextareaComponent,
} from '@ums/design-system';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ResearchStore } from './research.store';

/**
 * Research Profile page (FWEB-27/FWEB-28): a portfolio-style editor for publications and research
 * interests, the single source of truth also surfaced on `ums-public-web`'s faculty directory.
 */
@Component({
  selector: 'app-research',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsEmptyStateComponent,
    UmsInputComponent,
    UmsTextareaComponent,
    TranslatePipe,
  ],
  templateUrl: './research.component.html',
  styleUrl: './research.component.scss',
})
export class ResearchComponent implements OnInit {
  protected readonly store = inject(ResearchStore);

  protected readonly newTitle = signal('');
  protected readonly newVenue = signal('');
  protected readonly newYear = signal(String(new Date().getFullYear()));
  protected readonly newUrl = signal('');

  ngOnInit(): void {
    this.store.load();
  }

  protected onAddPublication(): void {
    const title = this.newTitle().trim();
    const venue = this.newVenue().trim();
    if (!title || !venue) {
      return;
    }
    this.store.addPublication({
      title,
      venue,
      year: Number(this.newYear()) || new Date().getFullYear(),
      url: this.newUrl().trim() || null,
    });
    this.newTitle.set('');
    this.newVenue.set('');
    this.newUrl.set('');
  }

  protected onToggleVisibility(localId: string): void {
    this.store.toggleVisibility(localId);
  }

  protected onRemove(localId: string): void {
    this.store.removePublication(localId);
  }

  protected onSave(): void {
    this.store.save();
  }
}
