export type PlanStatus = 'ACTIVE' | 'INACTIVE';
export type BillingInterval = 'MONTHLY' | 'YEARLY';
export type FeatureValueType = 'BOOLEAN' | 'INTEGER' | 'DECIMAL' | 'STRING' | 'JSON';

export interface PlanFeature {
  id: string;
  planId: string;
  featureId: string;
  enabled: boolean;
  value: unknown;
  createdAt: string;
  updatedAt: string;
  feature?: Feature; // When joined
  plan?: Plan; // When joined
}

export interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: PlanStatus;
  billingInterval: BillingInterval;
  basePrice: string;
  currency: string;
  trialDays: number | null;
  createdAt: string;
  updatedAt: string;
  planFeatures?: PlanFeature[];
}

export interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  valueType: FeatureValueType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { planFeatures: number };
  planFeatures?: PlanFeature[]; // When joined
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
