import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UmsButtonComponent, UmsFormFieldComponent, UmsInputComponent } from '@ums/design-system';
import { toUmsApiError } from '@ums/shared';
import { AuthService } from '../../core/auth/auth.service';
import { AUTH_ROUTES, RETURN_URL_QUERY_PARAM } from '../../core/auth/auth-routes.constants';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import {
  isLoginFormValid,
  validateLoginForm,
  type LoginFormErrors,
  type LoginFormValues,
} from './login-form.validation';

/**
 * Login for the Faculty portal (FWEB-4). Includes the "is this your personal device?"
 * prompt/toggle requirement-spec.md §5 mandates as this app's device-identification concept --
 * the answer is recorded via {@link AuthService.login}'s `isPersonalDevice` argument (defaults to
 * the safe "not personal" posture, matching {@link DeviceTrustService}'s own default, if the
 * faculty member never touches the toggle) and drives {@link SessionTimeoutService}'s shorter
 * shared-device timeout plus this app's absence of any "remember me" persistence option.
 *
 * Redirects to {@link AUTH_ROUTES.authenticatedHome} on success, or to `returnUrl` if `authGuard`
 * sent the faculty member here from a specific page they were trying to reach.
 */
@Component({
  selector: 'app-login-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UmsButtonComponent, UmsFormFieldComponent, UmsInputComponent, TranslatePipe],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
})
export class LoginFormComponent {
  private readonly authService = inject(AuthService);
  private readonly translation = inject(TranslationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly identifier = signal('');
  protected readonly password = signal('');
  protected readonly isPersonalDevice = signal(false);
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly serverErrorMessage = signal<string | null>(null);

  protected get formValues(): LoginFormValues {
    return { identifier: this.identifier(), password: this.password() };
  }

  protected get errors(): LoginFormErrors {
    return this.submitted() ? validateLoginForm(this.formValues) : {};
  }

  protected onSubmit(): void {
    this.submitted.set(true);
    this.serverErrorMessage.set(null);

    const errors = validateLoginForm(this.formValues);
    if (!isLoginFormValid(errors)) {
      return;
    }

    this.submitting.set(true);
    this.authService
      .login(this.identifier().trim(), this.password(), this.isPersonalDevice())
      .subscribe({
        next: () => {
          this.submitting.set(false);
          const returnUrl = this.route.snapshot.queryParamMap.get(RETURN_URL_QUERY_PARAM);
          void this.router.navigateByUrl(returnUrl || AUTH_ROUTES.authenticatedHome);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.serverErrorMessage.set(
            toUmsApiError(error).message || this.translation.t('login.serverError.generic'),
          );
        },
      });
  }
}
