import { Navigate, Route, Routes } from 'react-router-dom';
import { HealthPage } from '../features/health/HealthPage';
import { AdminLayout } from '../layouts/AdminLayout';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<HealthPage />} />
        <Route path="health" element={<HealthPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
