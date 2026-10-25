import { Component, computed, inject } from '@angular/core';
import { BarberService } from '../../../core/services/barber.service';

@Component({
  selector: 'app-earnings',
  standalone: true,
  imports: [],
  templateUrl: './earnings.html',
  styleUrl: './earnings.css',
})
export class EarningsComponent {
  private readonly data = inject(BarberService);
  readonly revenue = this.data.monthlyRevenue;
  readonly appointments = this.data.appointments;

  readonly maxRevenue = computed(() => Math.max(1, ...this.revenue().map((r) => r.total)));

  readonly totalYear = computed(() => this.revenue().reduce((s, r) => s + r.total, 0));

  readonly avgTicket = computed(() => {
    const confirmed = this.appointments().filter((a) => a.status === 'confirmado');
    if (!confirmed.length) return 0;
    return Math.round(confirmed.reduce((s, a) => s + a.price, 0) / confirmed.length);
  });

  barHeight(total: number): number {
    return Math.round((total / this.maxRevenue()) * 100);
  }

  formatPrice(value: number): string {
    return this.data.formatPrice(value);
  }
}
