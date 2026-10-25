import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { BarberService } from '../services/barber.service';

/** Solo entra el barbero con sesión válida (se verifica contra el servidor). */
export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const data = inject(BarberService);

  if (await data.verifyAdmin()) return true;
  return router.createUrlTree(['/admin/login']);
};
