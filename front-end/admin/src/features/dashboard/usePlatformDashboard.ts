import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { getPlatformHealth, type PlatformHealth } from '../../services/api/platform-health';
import { platformBillingApi } from '../../services/api/platform-billing';
import { getOrganizations } from '../../services/api/platform-organizations';
import { getPlatformStaff } from '../../services/api/platform-staff';
import { platformSubscriptionsApi } from '../../services/api/platform-subscriptions';
import type { RevenueOverview, Subscription } from '../../types/commercial';
import type { OrganizationListResponse } from '../../types/organization';
import type { PlatformStaffListResponse } from '../../types/platform-staff';

interface DashboardState {
  health: PlatformHealth | null;
  organizations: OrganizationListResponse | null;
  staff: PlatformStaffListResponse | null;
  subscriptions: { items: Subscription[]; meta: { totalItems: number } } | null;
  revenue: RevenueOverview | null;
  loading: boolean;
}

async function optionalRequest<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch {
    return null;
  }
}

export function usePlatformDashboard() {
  const { hasPermission } = useAuth();
  const canViewOrganizations = hasPermission('platform.organization.view');
  const canViewStaff = hasPermission('platform.staff.view');
  const canViewSubscriptions = hasPermission('subscription.subscription.view');
  const canViewRevenue = hasPermission('billing.revenue.view');
  const [state, setState] = useState<DashboardState>({
    health: null,
    organizations: null,
    staff: null,
    subscriptions: null,
    revenue: null,
    loading: true,
  });

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    const [health, organizations, staff, subscriptions, revenue] = await Promise.all([
      optionalRequest(getPlatformHealth()),
      canViewOrganizations
        ? optionalRequest(getOrganizations({ page: 1, limit: 5, sortBy: 'createdAt', order: 'desc' }))
        : Promise.resolve(null),
      canViewStaff
        ? optionalRequest(getPlatformStaff({ page: 1, limit: 1, sortBy: 'createdAt', order: 'desc' }))
        : Promise.resolve(null),
      canViewSubscriptions
        ? optionalRequest(platformSubscriptionsApi.list({ page: 1, pageSize: 5, sortBy: 'createdAt', order: 'desc' }))
        : Promise.resolve(null),
      canViewRevenue ? optionalRequest(platformBillingApi.overview()) : Promise.resolve(null),
    ]);
    setState({ health, organizations, staff, subscriptions, revenue, loading: false });
  }, [canViewOrganizations, canViewRevenue, canViewStaff, canViewSubscriptions]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return {
    ...state,
    reload,
    canViewOrganizations,
    canViewStaff,
    canViewSubscriptions,
    canViewRevenue,
  };
}
