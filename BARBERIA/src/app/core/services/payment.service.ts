import { Injectable } from '@angular/core';
import { API_URL } from '../api.config';
import { BookingStatus } from '../models/models';

export interface BookingPaymentData {
  bookingCode: string;
  clientName: string;
  clientWhatsapp: string;
  clientEmail: string;
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  /** Lo que ya se pagó en línea (0 si se paga todo en el local) */
  paidAmount: number;
  totalAmount: number;
}

/**
 * Pagos en línea con Wompi.
 *
 * Aquí NO hay llaves, firmas ni montos: el servidor (citas-server.js) calcula la seña,
 * firma el checkout y confirma con Wompi si el pago fue aprobado. Este servicio solo
 * lleva al cliente a la página de pago y consulta el resultado.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  /** Número de WhatsApp del negocio (formato internacional sin +) */
  private readonly BUSINESS_WHATSAPP = '573165033984';

  /** Lleva al cliente a la página de pago segura de Wompi. */
  goToCheckout(checkoutUrl: string): void {
    window.location.assign(checkoutUrl);
  }

  /** Consulta el estado actual de una reserva. */
  async getStatus(code: string): Promise<BookingStatus | null> {
    try {
      const res = await fetch(`${API_URL}/payments/status/${encodeURIComponent(code)}`);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  /** El cliente volvió de Wompi: el servidor verifica la transacción directamente con Wompi. */
  async confirm(code: string, transactionId: string): Promise<BookingStatus | null> {
    try {
      const res = await fetch(`${API_URL}/payments/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: code, transactionId }),
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  /** Pide un nuevo enlace de pago para una reserva que no se pudo pagar. */
  async retryCheckout(code: string): Promise<{ checkoutUrl?: string; error?: string }> {
    try {
      const res = await fetch(`${API_URL}/appointments/${encodeURIComponent(code)}/checkout`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      return res.ok ? { checkoutUrl: body.checkoutUrl } : { error: body.error ?? 'No se pudo generar el pago.' };
    } catch {
      return { error: 'No pudimos conectar con el servidor. Revisa tu conexión.' };
    }
  }

  private money(value: number): string {
    return '$' + value.toLocaleString('es-CO');
  }

  /** Link de WhatsApp con la confirmación pre-cargada para el cliente. */
  generateWhatsAppConfirmation(data: BookingPaymentData): string {
    const rest = data.totalAmount - data.paidAmount;
    const paymentLines = data.paidAmount > 0
      ? `💰 *Seña pagada:* ${this.money(data.paidAmount)}\n💵 *Restante en el local:* ${this.money(rest)}\n\n`
      : `💵 *Total a pagar en el local:* ${this.money(data.totalAmount)}\n\n`;

    const message = encodeURIComponent(
      `💈 *¡Bienvenido a Estudio 4-4-4 Barber!*\n` +
      `─────────────────\n` +
      `✅ *Turno Confirmado*\n\n` +
      `📋 *Código de reserva:* ${data.bookingCode}\n\n` +
      `👤 *Barbero:* ${data.barberName}\n` +
      `💈 *Servicio:* ${data.serviceName}\n` +
      `📅 *Fecha:* ${data.date}\n` +
      `🕒 *Hora:* ${data.time}\n\n` +
      paymentLines +
      `📍 Yopal, Casanare\n` +
      `📱 316 503 3984\n\n` +
      `¡Te esperamos! Más que un corte, es confianza. ✨`
    );
    return `https://wa.me/${data.clientWhatsapp.replace(/\D/g, '')}?text=${message}`;
  }

  /** Link de WhatsApp para avisar al negocio de un nuevo turno. */
  generateBusinessNotification(data: BookingPaymentData): string {
    const message = encodeURIComponent(
      `🔔 *¡Nuevo turno en Estudio 4-4-4 Barber!*\n\n` +
      `📋 *Código:* ${data.bookingCode}\n` +
      `👤 *Cliente:* ${data.clientName}\n` +
      `📱 *WhatsApp:* ${data.clientWhatsapp}\n\n` +
      `💈 *Servicio:* ${data.serviceName}\n` +
      `📅 *Fecha:* ${data.date}\n` +
      `🕒 *Hora:* ${data.time}\n\n` +
      `💰 *Total:* ${this.money(data.totalAmount)}\n` +
      `✅ *Pagado en línea:* ${this.money(data.paidAmount)}`
    );
    return `https://wa.me/${this.BUSINESS_WHATSAPP}?text=${message}`;
  }

  openWhatsAppConfirmation(data: BookingPaymentData): void {
    window.open(this.generateWhatsAppConfirmation(data), '_blank');
  }

  openBusinessNotification(data: BookingPaymentData): void {
    window.open(this.generateBusinessNotification(data), '_blank');
  }
}
