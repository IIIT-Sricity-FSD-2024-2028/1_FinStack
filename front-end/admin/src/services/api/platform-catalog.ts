import {
  Feature,
  PaginatedResult,
  Plan,
  PlanFeatureMutation,
  PlanMutation,
  PlanFeature,
  PlanStatus,
} from '../../types/catalog';
import { apiRequest } from './client';

function queryString(query: Record<string, unknown> | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const platformCatalogApi = {
  // --- Plans ---
  listPlans: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: PlanStatus;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResult<Plan>> => {
    return apiRequest<PaginatedResult<Plan>>(`/plans${queryString(params)}`);
  },

  getPlan: async (id: string): Promise<Plan> => {
    return apiRequest<Plan>(`/plans/${id}`);
  },

  createPlan: async (data: PlanMutation): Promise<Plan> => {
    return apiRequest<Plan>('/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updatePlan: async (id: string, data: PlanMutation): Promise<Plan> => {
    return apiRequest<Plan>(`/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  activatePlan: async (id: string): Promise<Plan> => {
    return apiRequest<Plan>(`/plans/${id}/activations`, { method: 'POST' });
  },

  deactivatePlan: async (id: string): Promise<Plan> => {
    return apiRequest<Plan>(`/plans/${id}/deactivations`, { method: 'POST' });
  },

  // --- Features ---
  listFeatures: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResult<Feature>> => {
    return apiRequest<PaginatedResult<Feature>>(`/features${queryString(params)}`);
  },

  getFeature: async (id: string): Promise<Feature> => {
    return apiRequest<Feature>(`/features/${id}`);
  },

  createFeature: async (data: Partial<Feature>): Promise<Feature> => {
    return apiRequest<Feature>('/features', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateFeature: async (id: string, data: Partial<Feature>): Promise<Feature> => {
    return apiRequest<Feature>(`/features/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  activateFeature: async (id: string): Promise<Feature> => {
    return apiRequest<Feature>(`/features/${id}/activations`, { method: 'POST' });
  },

  deactivateFeature: async (id: string): Promise<Feature> => {
    return apiRequest<Feature>(`/features/${id}/deactivations`, { method: 'POST' });
  },

  // --- Plan Features ---
  assignFeature: async (
    planId: string,
    data: { featureId: string } & PlanFeatureMutation,
  ): Promise<PlanFeature> => {
    return apiRequest<PlanFeature>(`/plans/${planId}/features`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updatePlanFeature: async (
    planId: string,
    featureId: string,
    data: PlanFeatureMutation,
  ): Promise<PlanFeature> => {
    return apiRequest<PlanFeature>(`/plans/${planId}/features/${featureId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  removePlanFeature: async (planId: string, featureId: string): Promise<void> => {
    return apiRequest<void>(`/plans/${planId}/features/${featureId}`, {
      method: 'DELETE',
    });
  },
};
