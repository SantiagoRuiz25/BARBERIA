import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BarberService } from '../../../core/services/barber.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class AdminLoginComponent {
  private readonly data = inject(BarberService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly pass = signal('');
  readonly error = signal('');
  readonly loading = signal(false);

  async submit() {
    this.error.set('');

    if (!this.email().trim() || !this.pass().trim()) {
      this.error.set('Ingresa correo y contraseña.');
      return;
    }

    this.loading.set(true);
    // La validación la hace el servidor: ya no hay contraseña escrita en el código de la web
    const result = await this.data.adminLogin(this.email().trim(), this.pass());
    this.loading.set(false);

    if (result.ok) {
      this.router.navigate(['/admin']);
    } else {
      this.error.set(result.message);
    }
  }
}
