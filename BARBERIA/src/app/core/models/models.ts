export interface Barber {
  id: string;
  name: string;
  role: string;
  photo: string;
  bio: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMin: number;
  icon: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface GalleryImage {
  id: string;
  url: string;
  alt: string;
}

export interface BookingSelection {
  barber: Barber | null;
  service: ServiceItem | null;
  date: Date | null;
  time: string | null;
}

export interface Appointment {
  id: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  barberName: string;
  serviceName: string;
  /** Fecha para mostrar, ej. "22 de oct de 2026" */
  date: string;
  /** Fecha para ordenar y filtrar, formato YYYY-MM-DD */
  dateISO: string;
  time: string;
  price: number;
  status: 'confirmado' | 'pendiente' | 'cancelado';
  paymentMethod?: PaymentMethod;
  /** pendiente_local = se paga en el local · esperando_pago = en línea sin pagar aún */
  paymentStatus?: PaymentStatus;
  /** Seña que se cobra en línea (calculada por el servidor) */
  depositAmount?: number;
  amountPaid?: number;
  paidAt?: string;
  /** Pagó en línea pero la hora ya no estaba libre: hay que reembolsar */
  needsRefund?: boolean;
  createdAt?: string;
}

export type PaymentMethod = 'efectivo' | 'wompi' | 'pse' | 'tarjeta';
export type PaymentStatus = 'pendiente_local' | 'esperando_pago' | 'pagado' | 'rechazado' | 'expirado';

/** Lo que el cliente puede ver de su reserva (sin teléfono ni correo). */
export interface BookingStatus {
  id: string;
  status: Appointment['status'];
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  serviceName: string;
  barberName: string;
  date: string;
  dateISO: string;
  time: string;
  price: number;
  depositAmount: number;
  holdUntil: string | null;
}

export interface AppConfig {
  onlinePayments: boolean;
  sandbox: boolean | null;
  depositPercent: number;
  holdMinutes: number;
}

/** Datos que el cliente envía al servidor para reservar (el precio lo calcula el servidor). */
export interface NewAppointment {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  barberId: string;
  serviceId: string;
  dateISO: string;
  time: string;
  paymentMethod: PaymentMethod;
}

export type AppointmentStatus = Appointment['status'];

export type CreateAppointmentResult =
  | { ok: true; id: string; checkoutUrl?: string; depositAmount: number }
  | { ok: false; reason: 'taken' | 'invalid' | 'network'; message: string };
