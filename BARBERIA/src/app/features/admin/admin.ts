import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { BarberService } from '../../core/services/barber.service';

/** Cada cuántos segundos el panel pide al servidor las citas nuevas. */
const REFRESH_SECONDS = 8;

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  readonly data = inject(BarberService);

  readonly menuOpen = signal(false);
  readonly barberName = localStorage.getItem('barberName') || 'Barbero';

  private timer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.refresh();
    // Así las reservas nuevas aparecen solas, sin recargar la página
    this.timer = setInterval(() => this.refresh(), REFRESH_SECONDS * 1000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  private async refresh() {
    const result = await this.data.refreshAppointments();
    if (result === 'unauthorized') this.logout(); // la sesión venció
  }

  toggleMenu() {
    this.menuOpen.update((v) => !v);
  }

  logout() {
    this.data.adminLogout();
    this.router.navigate(['/admin/login']);
  }
}
