import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BarberService } from '../../../core/services/barber.service';

type AboutTab = 'historia' | 'barberos' | 'ubicacion' | 'pagos';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent {
  private readonly data = inject(BarberService);

  readonly barbers = this.data.barbers;
  readonly services = this.data.services;
  readonly faqs = this.data.faqs;

  readonly aboutTab = signal<AboutTab>('barberos');
  readonly openFaqIndex = signal<number | null>(0);

  setAboutTab(tab: AboutTab) {
    this.aboutTab.set(tab);
  }

  toggleFaq(index: number) {
    this.openFaqIndex.update((current) => (current === index ? null : index));
  }

  formatPrice(value: number): string {
    return this.data.formatPrice(value);
  }
}
