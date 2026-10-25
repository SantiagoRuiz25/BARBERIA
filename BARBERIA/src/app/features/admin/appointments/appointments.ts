import { Component, computed, inject, signal } from '@angular/core';
import { BarberService } from '../../../core/services/barber.service';
import { Appointment, AppointmentStatus } from '../../../core/models/models';

type Filter = 'todos' | 'confirmado' | 'pendiente' | 'cancelado';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [],
  templateUrl: './appointments.html',
  styleUrl: './appointments.css',
})
export class AppointmentsComponent {
  private readonly data = inject(BarberService);
  readonly all = this.data.appointments;
  readonly filter = signal<Filter>('todos');
  readonly savingId = signal<string | null>(null);
  readonly error = signal('');

  readonly filtered = computed(() => {
    const f = this.filter();
    return f === 'todos' ? this.all() : this.all().filter((a) => a.status === f);
  });

  setFilter(f: Filter) {
    this.filter.set(f);
  }

  /** Guarda el nuevo estado en el servidor y lo refleja en la lista. */
  async setStatus(appointment: Appointment, status: AppointmentStatus) {
    if (this.savingId()) return;
    this.savingId.set(appointment.id);
    this.error.set('');

    const result = await this.data.updateAppointmentStatus(appointment.id, status);
    this.savingId.set(null);

    if (result === 'ok') return;
    if (result === 'unauthorized') {
      this.error.set('Tu sesión expiró. Vuelve a entrar al panel.');
      return;
    }
    this.error.set('No se pudo actualizar el turno. Intenta de nuevo.');
  }

  /** Marca como cobrado el pago que se hace en el local. */
  async markPaid(appointment: Appointment) {
    if (this.savingId()) return;
    this.savingId.set(appointment.id);
    this.error.set('');
    const result = await this.data.markAppointmentPaid(appointment.id);
    this.savingId.set(null);
    if (result === 'ok') return;
    this.error.set(result === 'unauthorized' ? 'Tu sesión expiró. Vuelve a entrar al panel.' : 'No se pudo marcar el cobro. Intenta de nuevo.');
  }

  /** Elimina del registro un turno (pide confirmación). */
  async remove(appointment: Appointment) {
    if (this.savingId()) return;
    if (!confirm(`¿Eliminar el turno de ${appointment.clientName} (${appointment.date} ${appointment.time})? Esta acción no se puede deshacer.`)) return;
    this.savingId.set(appointment.id);
    this.error.set('');
    const result = await this.data.deleteAppointment(appointment.id);
    this.savingId.set(null);
    if (result === 'ok') return;
    this.error.set(result === 'unauthorized' ? 'Tu sesión expiró. Vuelve a entrar al panel.' : 'No se pudo eliminar el turno. Intenta de nuevo.');
  }

  paymentLabel(a: Appointment): string {
    if (a.needsRefund) return 'Reembolsar';
    switch (a.paymentStatus) {
      case 'pagado': return a.amountPaid && a.amountPaid < a.price ? `Seña ${this.formatPrice(a.amountPaid)}` : 'Pagado';
      case 'esperando_pago': return 'Esperando pago';
      case 'rechazado': return 'Pago rechazado';
      case 'pendiente_local': return 'Paga en el local';
      default: return '—';
    }
  }

  isSaving(id: string): boolean {
    return this.savingId() === id;
  }

  formatPrice(value: number): string {
    return this.data.formatPrice(value);
  }
}
