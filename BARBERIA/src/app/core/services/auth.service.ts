import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { API_URL } from '../api.config';

export type AuthMethod = 'phone' | 'email' | 'apple';
export type AuthStep = 'choose' | 'enter' | 'verify';

export interface User {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  authMethod: AuthMethod;
  verified: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly BUSINESS_WHATSAPP = '573165033984';
  private readonly apiUrl = API_URL;

  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = signal(false);
  readonly step = signal<AuthStep>('choose');
  readonly selectedMethod = signal<AuthMethod | null>(null);
  readonly target = signal('');
  readonly verificationCode = signal('');

  constructor(private router: Router) {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const saved = localStorage.getItem('444_user');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      } catch {
        localStorage.removeItem('444_user');
      }
    }
  }

  private saveToStorage(user: User) {
    localStorage.setItem('444_user', JSON.stringify(user));
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  selectMethod(method: AuthMethod) {
    this.selectedMethod.set(method);
    this.step.set('enter');
  }

  goBack() {
    this.step.set('choose');
    this.selectedMethod.set(null);
    this.target.set('');
    this.verificationCode.set('');
  }

  /**
   * Enviar código por WhatsApp.
   */
  sendPhoneCode(phone: string): void {
    const cleanPhone = phone.replace(/\D/g, '');
    const code = this.generateCode();

    this.verificationCode.set(code);
    this.target.set(cleanPhone);
    this.step.set('verify');

    const message = encodeURIComponent(
      `🔑 *Código de verificación — Estudio 4-4-4 Barber*\n\n` +
      `Tu código es: *${code}*\n\n` +
      `No compartas este código con nadie.\n` +
      `Si no solicitaste este código, ignora este mensaje.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  }

  /**
   * Enviar código por correo usando el backend.
   */
  async sendEmailCode(email: string): Promise<void> {
    const code = this.generateCode();

    this.verificationCode.set(code);
    this.target.set(email);
    this.step.set('verify');

    try {
      const response = await fetch(`${this.apiUrl}/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      if (!response.ok) {
        throw new Error('Error al enviar correo');
      }

      console.log(`Código ${code} enviado a ${email}`);
    } catch (error) {
      console.error('Error enviando correo:', error);
      alert(
        `Código de verificación: ${code}\n\n` +
        `(Modo demo: el correo no se envió. Iniciá el servidor con: node server.js)`
      );
    }
  }

  /**
   * Login con Apple (simulado).
   */
  loginWithApple(): void {
    const mockUser: User = {
      id: 'apple_' + Date.now(),
      name: 'Usuario Apple',
      authMethod: 'apple',
      verified: true,
    };

    this.currentUser.set(mockUser);
    this.isAuthenticated.set(true);
    this.saveToStorage(mockUser);
    this.router.navigate(['/reservar']);
  }

  /**
   * Verificar el código ingresado.
   */
  verifyCode(inputCode: string): boolean {
    if (inputCode === this.verificationCode()) {
      const method = this.selectedMethod();
      const tgt = this.target();

      const user: User = {
        id: method + '_' + Date.now(),
        name: method === 'phone' ? 'Usuario' : tgt.split('@')[0],
        phone: method === 'phone' ? tgt : undefined,
        email: method === 'email' ? tgt : undefined,
        authMethod: method!,
        verified: true,
      };

      this.currentUser.set(user);
      this.isAuthenticated.set(true);
      this.step.set('choose');
      this.selectedMethod.set(null);
      this.target.set('');
      this.verificationCode.set('');
      this.saveToStorage(user);
      return true;
    }
    return false;
  }

  logout(): void {
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.step.set('choose');
    this.selectedMethod.set(null);
    this.target.set('');
    this.verificationCode.set('');
    localStorage.removeItem('444_user');
    this.router.navigate(['/']);
  }
}
