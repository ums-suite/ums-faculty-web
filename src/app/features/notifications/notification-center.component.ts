import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { UmsBadgeComponent, UmsButtonComponent, UmsEmptyStateComponent } from '@ums/design-system';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { NotificationCenterStore } from './notification-center.store';

/**
 * Notification Center (FWEB-29): a simple chronological list of leave decisions,
 * review-status changes, and low-attendance flags. Deliberately unremarkable in design (§7 -- this
 * app's visual budget is spent on Dashboard/Attendance, not here).
 */
@Component({
  selector: 'app-notification-center',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UmsBadgeComponent, UmsButtonComponent, UmsEmptyStateComponent, TranslatePipe],
  templateUrl: './notification-center.component.html',
  styleUrl: './notification-center.component.scss',
})
export class NotificationCenterComponent implements OnInit {
  protected readonly store = inject(NotificationCenterStore);

  ngOnInit(): void {
    this.store.load();
  }

  protected onMarkRead(id: string): void {
    this.store.markRead(id);
  }

  protected onMarkAllRead(): void {
    this.store.markAllRead();
  }
}
