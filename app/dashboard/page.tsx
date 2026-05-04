/**
 * Dashboard del Agente - Ruta Protegida
 * Requiere autenticación para acceder
 */

import AgentDashboard from '../AgentDashboard';

export const metadata = {
  title: 'Panel de control - QodeIA Agent',
  description: 'Panel de control del agente autónomo QodeIA',
};

export default function DashboardPage() {
  return <AgentDashboard />;
}
