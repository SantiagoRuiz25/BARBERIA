import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../components/header/header';
import { Footer } from '../components/footer/footer';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, Footer],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {}
