/**
 * Ruta raíz (/) - Redirige a la landing page pública
 * Cambio: Antes iba directo a AgentDashboard, ahora muestra landing sin login
 */

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/home');
}
