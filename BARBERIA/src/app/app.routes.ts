import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { Layout } from './shared/layout/layout';

export const routes: Routes = [
  // --- VISTAS PÚBLICAS (Clientes) ---
  {
    path: '',
    component: Layout,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/public/home/home').then(m => m.HomeComponent)
      },
      {
        path: 'galeria',
        loadComponent: () => import('./features/public/gallery/gallery').then(m => m.GalleryComponent)
      },
      {
        path: 'reservar',
        loadComponent: () => import('./features/public/booking/booking').then(m => m.BookingComponent)
      },
      {
        path: 'reservar/pago/:code',
        loadComponent: () => import('./features/public/payment-result/payment-result').then(m => m.PaymentResultComponent)
      },
    ]
  },

  // --- LOGIN ADMIN (público, sin guard) ---
  {
    path: 'admin/login',
    loadComponent: () => import('./features/admin/login/login').then(m => m.AdminLoginComponent)
  },

  // --- PANEL PRIVADO (Solo el Barbero) ---
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./features/admin/admin').then(m => m.Admin),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'turnos',
        loadComponent: () => import('./features/admin/appointments/appointments').then(m => m.AppointmentsComponent)
      },
      {
        path: 'finanzas',
        loadComponent: () => import('./features/admin/earnings/earnings').then(m => m.EarningsComponent)
      },
    ]
  },

  // Redirección por defecto
  { path: '**', redirectTo: '' }
];
