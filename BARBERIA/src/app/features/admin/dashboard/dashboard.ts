import { Component, computed, inject, signal } from '@angular/core';
import { BarberService } from '../../../core/services/barber.service';
import { Appointment, AppointmentStatus } from '../../../core/models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {
  readonly data = inject(BarberService);

  readonly appointments = this.data.appointments;
  readonly barbers = this.data.barbers;

  readonly todayAppointments = computed(() => {
    const today = this.data.toISODate(new Date());
    return this.appointments().filter((a) => a.dateISO === today);
  });

  readonly maxMonthly = computed(() => Math.max(1, ...this.data.monthlyRevenue().map((m) => m.total)));

  readonly confirmedToday = computed(
    () => this.todayAppointments().filter((a) => a.status === 'confirmado').length
  );

  readonly revenueToday = computed(() =>
    this.todayAppointments()
      .filter((a) => a.status === 'confirmado')
      .reduce((sum, a) => sum + a.price, 0)
  );

  readonly pendingCount = computed(
    () => this.appointments().filter((a) => a.status === 'pendiente').length
  );

  readonly totalCuts = computed(
    () => this.appointments().filter((a) => a.status === 'confirmado').length
  );

  readonly totalRevenue = computed(() =>
    this.appointments()
      .filter((a) => a.status === 'confirmado')
      .reduce((sum, a) => sum + a.price, 0)
  );

  readonly confirmedAppointments = computed(() =>
    this.appointments().filter((a) => a.status === 'confirmado')
  );

  readonly pendingAppointments = computed(() =>
    this.appointments().filter((a) => a.status === 'pendiente')
  );

  readonly cancelledAppointments = computed(() =>
    this.appointments().filter((a) => a.status === 'cancelado')
  );

  formatPrice(value: number): string {
    return this.data.formatPrice(value);
  }

  readonly savingId = signal<string | null>(null);
  readonly actionError = signal('');

  /** Confirma o cancela un turno pendiente desde el dashboard. */
  async setStatus(appointment: Appointment, status: AppointmentStatus) {
    if (this.savingId()) return;
    this.savingId.set(appointment.id);
    this.actionError.set('');

    const result = await this.data.updateAppointmentStatus(appointment.id, status);
    this.savingId.set(null);

    if (result === 'ok') return;
    if (result === 'unauthorized') {
      this.actionError.set('Tu sesión expiró. Vuelve a entrar al panel.');
      return;
    }
    this.actionError.set('No se pudo actualizar el turno. Intenta de nuevo.');
  }

  isSaving(id: string): boolean {
    return this.savingId() === id;
  }
}
