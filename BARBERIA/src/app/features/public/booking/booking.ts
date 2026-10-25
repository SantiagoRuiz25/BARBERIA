import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BarberService } from '../../../core/services/barber.service';
import { PaymentService, BookingPaymentData } from '../../../core/services/payment.service';
import { Barber, ServiceItem, TimeSlot } from '../../../core/models/models';

type Step = 1 | 2 | 3 | 4;

interface CalendarDay {
  date: Date;
  inMonth: boolean;
  past: boolean;
  closed: boolean;
}

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './booking.html',
  styleUrl: './booking.css',
})
export class BookingComponent {
  private readonly data = inject(BarberService);
  private readonly payment = inject(PaymentService);

  readonly barbers = this.data.barbers;
  readonly services = this.data.services;

  readonly step = signal<Step>(1);
  readonly confirmed = signal(false);
  readonly bookingCode = signal('');

  readonly selectedBarber = signal<Barber | null>(null);
  readonly selectedService = signal<ServiceItem | null>(null);
  readonly selectedDate = signal<Date | null>(null);
  readonly selectedTime = signal<string | null>(null);

  readonly viewMonth = signal(this.startOfMonth(new Date()));

  readonly clientName = signal('');
  readonly clientWhatsapp = signal('');
  readonly clientEmail = signal('');
  readonly paymentMethod = signal<'wompi' | 'efectivo'>('efectivo');
  readonly config = this.data.config;
  readonly acceptedTerms = signal(false);
  readonly loading = signal(false);
  readonly whatsappSent = signal(false);
  readonly bookingError = signal('');
  readonly slotsLoading = this.data.slotsLoading;
  readonly slotsError = this.data.slotsError;

  readonly monthLabel = computed(() =>
    this.viewMonth().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  );

  readonly calendarDays = computed<CalendarDay[]>(() => {
    const month = this.viewMonth();
    const year = month.getFullYear();
    const monthIdx = month.getMonth();
    const firstDay = new Date(year, monthIdx, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: CalendarDay[] = [];
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, monthIdx, 1 - (startOffset - i));
      days.push({ date: d, inMonth: false, past: true, closed: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, monthIdx, d);
      days.push({
        date,
        inMonth: true,
        past: date < today,
        closed: date.getDay() === 0,
      });
    }
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      days.push({ date: d, inMonth: false, past: false, closed: false });
    }
    return days;
  });

  readonly availability = computed<TimeSlot[]>(() => {
    const date = this.selectedDate();
    if (!date) return [];
    return this.data.getAvailability(date);
  });

  /** Seña que se cobra en línea (el servidor calcula el valor real; esto es solo para mostrarlo). */
  readonly depositAmount = computed(() => {
    const price = this.selectedService()?.price ?? 0;
    const pct = this.config()?.depositPercent ?? 50;
    return Math.round((price * pct) / 100);
  });

  readonly onlineAvailable = computed(() => this.config()?.onlinePayments === true);

  /** Lo que se paga ahora según el método elegido. */
  readonly payNow = computed(() => (this.paymentMethod() === 'wompi' ? this.depositAmount() : 0));

  readonly canConfirm = computed(
    () =>
      !!this.selectedBarber() &&
      !!this.selectedService() &&
      !!this.selectedDate() &&
      !!this.selectedTime() &&
      this.clientName().trim().length > 1 &&
      this.clientWhatsapp().replace(/\D/g, '').length >= 7 &&
      this.validEmail() &&
      this.acceptedTerms() &&
      (this.paymentMethod() === 'efectivo' || this.onlineAvailable())
  );

  /** El correo es opcional, pero si lo escriben debe ser válido. */
  private validEmail(): boolean {
    const email = this.clientEmail().trim();
    return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  constructor() {
    this.data.loadConfig().then(() => {
      // Si hay pago en línea, lo sugerimos primero
      if (this.onlineAvailable()) this.paymentMethod.set('wompi');
    });
  }

  private startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private buildPaymentData(): BookingPaymentData {
    return {
      bookingCode: this.bookingCode(),
      clientName: this.clientName(),
      clientWhatsapp: this.clientWhatsapp(),
      clientEmail: this.clientEmail(),
      serviceName: this.selectedService()!.name,
      barberName: this.selectedBarber()!.name,
      date: this.formatSelectedDate(),
      time: this.selectedTime()!,
      paidAmount: 0,
      totalAmount: this.selectedService()!.price,
    };
  }

  goToStep(target: Step) {
    if (target < this.step()) this.step.set(target);
  }

  selectBarber(barber: Barber) {
    this.selectedBarber.set(barber);
    this.step.set(2);
  }

  selectService(service: ServiceItem) {
    this.selectedService.set(service);
  }

  continueToSchedule() {
    if (this.selectedService()) this.step.set(3);
  }

  prevMonth() {
    const m = this.viewMonth();
    this.viewMonth.set(new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  nextMonth() {
    const m = this.viewMonth();
    this.viewMonth.set(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  selectDate(day: CalendarDay) {
    if (day.past || day.closed) return;
    this.selectedDate.set(day.date);
    this.selectedTime.set(null);
    this.bookingError.set('');
    // Trae del servidor las horas que otros clientes ya reservaron ese día
    this.data.loadTaken(this.data.toISODate(day.date));
  }

  selectTime(slot: TimeSlot) {
    if (!slot.available) return;
    this.selectedTime.set(slot.time);
  }

  continueToConfirm() {
    if (this.selectedDate() && this.selectedTime()) this.step.set(4);
  }

  setPayment(method: 'wompi' | 'efectivo') {
    this.paymentMethod.set(method);
  }

  async confirmBooking() {
    if (!this.canConfirm() || this.loading()) return;
    this.loading.set(true);
    this.bookingError.set('');

    const method = this.paymentMethod();
    const dateISO = this.data.toISODate(this.selectedDate()!);

    // La cita se guarda en el servidor: la hora queda retenida mientras se paga
    const result = await this.data.createAppointment({
      clientName: this.clientName().trim(),
      clientPhone: this.clientWhatsapp().trim(),
      clientEmail: this.clientEmail().trim(),
      barberId: this.selectedBarber()!.id,
      serviceId: this.selectedService()!.id,
      dateISO,
      time: this.selectedTime()!,
      paymentMethod: method,
    });

    if (!result.ok) {
      this.loading.set(false);
      this.bookingError.set(result.message);
      if (result.reason === 'taken') {
        // Alguien ganó esa hora: volvemos a elegir horario con la lista actualizada
        this.selectedTime.set(null);
        this.step.set(3);
        this.data.loadTaken(dateISO);
      }
      return;
    }

    this.bookingCode.set(result.id);

    if (result.checkoutUrl) {
      // Pago en línea: guardamos lo mínimo para el WhatsApp de confirmación y vamos a Wompi.
      // La reserva solo se confirma cuando Wompi aprueba el pago (la verifica el servidor).
      try {
        sessionStorage.setItem(
          '444_booking_' + result.id,
          JSON.stringify({ name: this.clientName().trim(), whatsapp: this.clientWhatsapp().trim(), email: this.clientEmail().trim() })
        );
      } catch { /* sin almacenamiento: el cliente igual verá su código */ }
      this.payment.goToCheckout(result.checkoutUrl);
      return; // la página se reemplaza; no apagamos "loading" para evitar dobles clics
    }

    // Pago en el local: la cita ya quedó confirmada
    this.confirmed.set(true);
    this.loading.set(false);
  }

  /** Enviar WhatsApp manual desde la pantalla de éxito */
  resendWhatsApp() {
    const paymentData = this.buildPaymentData();
    this.payment.openWhatsAppConfirmation(paymentData);
    this.whatsappSent.set(true);
  }

  formatPrice(value: number): string {
    return this.data.formatPrice(value);
  }

  formatSelectedDate(): string {
    const date = this.selectedDate();
    if (!date) return '';
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
