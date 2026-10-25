import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService, AuthMethod } from '../../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class AuthComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly step = this.auth.step;
  readonly selectedMethod = this.auth.selectedMethod;
  readonly target = this.auth.target;
  readonly verificationTarget = this.auth.target;

  readonly phoneInput = signal('');
  readonly emailInput = signal('');
  readonly verificationInput = signal('');
  readonly error = signal('');
  readonly loading = signal(false);

  selectMethod(method: AuthMethod) {
    this.auth.selectMethod(method);
    this.phoneInput.set('');
    this.emailInput.set('');
    this.error.set('');
  }

  sendCode() {
    this.error.set('');
    this.loading.set(true);

    const method = this.selectedMethod();

    if (method === 'phone') {
      const phone = this.phoneInput().trim();
      if (phone.length < 8) {
        this.error.set('Ingresa un número de teléfono válido');
        this.loading.set(false);
        return;
      }
      setTimeout(() => {
        this.auth.sendPhoneCode(phone);
        this.loading.set(false);
      }, 600);
    }

    if (method === 'email') {
      const email = this.emailInput().trim();
      if (!email.includes('@') || !email.includes('.')) {
        this.error.set('Ingresa un correo electrónico válido');
        this.loading.set(false);
        return;
      }
      this.auth.sendEmailCode(email).then(() => {
        this.loading.set(false);
      });
    }
  }

  verifyCode() {
    const code = this.verificationInput().trim();
    if (code.length !== 6) {
      this.error.set('El código debe tener 6 dígitos');
      return;
    }
    this.error.set('');
    this.loading.set(true);

    setTimeout(() => {
      const success = this.auth.verifyCode(code);
      if (success) {
        this.router.navigate(['/reservar']);
      } else {
        this.error.set('Código incorrecto. Intenta de nuevo.');
        this.loading.set(false);
      }
    }, 500);
  }

  goBack() {
    this.auth.goBack();
    this.phoneInput.set('');
    this.emailInput.set('');
    this.verificationInput.set('');
    this.error.set('');
    this.loading.set(false);
  }
}
