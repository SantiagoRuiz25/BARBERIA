import { Component, inject, signal, computed } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BarberService } from '../../../core/services/barber.service';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './gallery.html',
  styleUrl: './gallery.css',
})
export class GalleryComponent {
  private readonly data = inject(BarberService);
  readonly images = this.data.gallery;
  readonly activeIndex = signal(0);

  readonly active = computed(() => this.images()[this.activeIndex()]);

  select(index: number) {
    this.activeIndex.set(index);
  }

  prev() {
    this.activeIndex.update((i) => (i === 0 ? this.images().length - 1 : i - 1));
  }

  next() {
    this.activeIndex.update((i) => (i === this.images().length - 1 ? 0 : i + 1));
  }
}
