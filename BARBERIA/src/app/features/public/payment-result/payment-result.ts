import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PaymentService, BookingPaymentData } from '../../../core/services/payment.service';
import { BookingStatus } from '../../../core/models/models';

type View = 'checking' | 'paid' | 'waiting' | 'rejected' | 'expired' | 'notfound';

/**
 * Pantalla a la que Wompi devuelve al cliente (/reservar/pago/:code?id=<transacción>).
 * Aquí NO se cree lo que diga la URL: el servidor consulta a Wompi y responde el estado real.
 */
@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './payment-result.html',
  styleUrl: './payment-result.css',
})
export class PaymentResultComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly payment = inject(PaymentService);

  readonly code = this.route.snapshot.paramMap.get('code') ?? '';
  private readonly transactionId = this.route.snapshot.queryParamMap.get('id') ?? '';

  readonly booking = signal<BookingStatus | null>(null);
  readonly view = signal<View>('checking');
  readonly retrying = signal(false);
  readonly error = signal('');
  readonly whatsappSent = signal(false);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;

  readonly remaining = computed(() => {
    const b = this.booking();
    return b ? b.price - (b.depositAmount ?? 0) : 0;
  });

  async ngOnInit() {
    await this.refresh(true);
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private async refresh(first = false) {
    const status =
      first && this.transactionId
        ? await this.payment.confirm(this.code, this.transactionId)
        : await this.payment.getStatus(this.code);

    if (!status) {
      this.view.set(first ? 'notfound' : this.view());
      return;
    }
    this.booking.set(status);

    if (status.paymentStatus === 'pagado' && status.status === 'confirmado') this.view.set('paid');
    else if (status.paymentStatus === 'rechazado') this.view.set('rejected');
    else if (status.status === 'cancelado') this.view.set('expired');
    else {
      // Pago todavía en proceso (PSE puede tardar unos segundos o minutos): seguimos preguntando
      this.view.set('waiting');
      if (++this.attempts < 40) {
        this.timer = setTimeout(() => this.refresh(), 4000);
      }
    }
  }

  async retry() {
    this.retrying.set(true);
    this.error.set('');
    const result = await this.payment.retryCheckout(this.code);
    if (result.checkoutUrl) {
      this.payment.goToCheckout(result.checkoutUrl);
      return;
    }
    this.retrying.set(false);
    this.error.set(result.error ?? 'No se pudo generar el pago.');
  }

  /** Datos del cliente guardados en este navegador antes de ir a Wompi. */
  private saved(): { name: string; whatsapp: string; email: string } | null {
    try {
      return JSON.parse(sessionStorage.getItem('444_booking_' + this.code) ?? 'null');
    } catch {
      return null;
    }
  }

  readonly canSendWhatsApp = computed(() => !!this.saved()?.whatsapp);

  sendWhatsApp() {
    const b = this.booking();
    const saved = this.saved();
    if (!b || !saved) return;
    const data: BookingPaymentData = {
      bookingCode: b.id,
      clientName: saved.name,
      clientWhatsapp: saved.whatsapp,
      clientEmail: saved.email,
      serviceName: b.serviceName,
      barberName: b.barberName,
      date: b.date,
      time: b.time,
      paidAmount: b.depositAmount,
      totalAmount: b.price,
    };
    this.payment.openWhatsAppConfirmation(data);
    this.whatsappSent.set(true);
  }

  formatPrice(value: number): string {
    return '$' + value.toLocaleString('es-CO');
  }
}
