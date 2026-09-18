import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  UmsBadgeComponent,
  UmsDatePickerComponent,
  UmsEmptyStateComponent,
  UmsFileUploadComponent,
  UmsInputComponent,
  UmsSelectComponent,
  type SelectOption,
  type UploadableFile,
} from '@ums/design-system';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { MaterialsStore } from './materials.store';
import type { LectureMaterialTypeCode, PendingUpload } from './materials.types';

/**
 * Course Materials page (FWEB-22/FWEB-23): a drag-and-drop uploader, a per-CourseOffering material
 * list with version history, and scheduled release. `courseOfferingId` arrives as a query param,
 * matching Attendance/Grading's own precedent.
 */
@Component({
  selector: 'app-materials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsDatePickerComponent,
    UmsEmptyStateComponent,
    UmsFileUploadComponent,
    UmsInputComponent,
    UmsSelectComponent,
    TranslatePipe,
  ],
  templateUrl: './materials.component.html',
  styleUrl: './materials.component.scss',
})
export class MaterialsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly translation = inject(TranslationService);
  protected readonly store = inject(MaterialsStore);

  protected readonly moduleGroup = signal('');
  protected readonly title = signal('');
  protected readonly replacesMaterialId = signal('');
  protected readonly scheduledDate = signal<string | null>(null);

  protected readonly replaceOptions = computed<readonly SelectOption[]>(() => [
    { value: '', label: this.translation.t('materials.upload.newMaterial') },
    ...this.store.materials().map((m) => ({ value: m.id, label: m.title })),
  ]);

  protected readonly uploadFiles = computed<readonly UploadableFile[]>(() =>
    this.store.uploads().map((u) => this.toUploadableFile(u)),
  );

  ngOnInit(): void {
    const courseOfferingId = this.route.snapshot.queryParamMap.get('courseOfferingId');
    if (courseOfferingId) {
      this.store.openCourseOffering(courseOfferingId);
    }
  }

  ngOnDestroy(): void {
    this.store.closeCourseOffering();
  }

  protected onFilesSelected(fileList: FileList): void {
    const materialType: LectureMaterialTypeCode = 'Document';
    const scheduledFor = this.scheduledDate() ? `${this.scheduledDate()}T00:00:00.000Z` : null;
    for (const file of Array.from(fileList)) {
      this.store.startUpload(file, {
        materialType,
        moduleGroup: this.moduleGroup() || 'General',
        title: this.title() || file.name,
        replacesMaterialId: this.replacesMaterialId() || null,
        scheduledFor,
      });
    }
  }

  protected onRetry(localId: string): void {
    this.store.retryUpload(localId);
  }

  protected onRemove(localId: string): void {
    this.store.removeUpload(localId);
  }

  private toUploadableFile(upload: PendingUpload): UploadableFile {
    return {
      id: upload.localId,
      name: upload.fileName,
      sizeBytes: upload.fileSizeBytes,
      progress: upload.progress,
      status: this.toFileUploadStatus(upload),
      errorMessage: upload.errorKey ? this.translation.t(upload.errorKey) : undefined,
    };
  }

  private toFileUploadStatus(upload: PendingUpload): UploadableFile['status'] {
    switch (upload.phase) {
      case 'error':
        return 'error';
      case 'success':
      case 'scheduled':
        return 'success';
      case 'uploading':
        return 'uploading';
      default:
        return 'pending';
    }
  }
}
