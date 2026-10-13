export interface PublicPlan {
  id: string;
  name: string;
  currency: string;
  basePrice: string;
  billingInterval: string;
  additionalEmployeePrice: string;
  description?: string;
  trialDays?: number;
  includedEmployeeCount: number;
  features: {
    id: string;
    name: string;
    key?: string;
    value?: string | number | boolean;
    description?: string;
    isAddOn: boolean;
    addOnPrice: string;
  }[];
}
export interface PublicPlans {
  items: PublicPlan[];
}
export interface SubscriptionSummary {
  organization: { id: string; name: string };
  plan: { name: string };
  currency: string;
  status: string;
  employeeCount: number;
}
export interface Notification {
  id: string;
  title: string;
  message: string;
  unread: boolean;
  createdAt: string;
}
export interface NotificationPage {
  items: Notification[];
  unreadCount: number;
  totalPages: number;
  total: number;
}
export interface EmployeeProfile {
  department: string;
}
export interface Quote {
  baseAmount: string;
  employeeAmount: string;
  featureAmount: string;
  currency: string;
  totalAmount: string;
  billingInterval: string;
}
export interface RegistrationReceipt {
  employeeId: string;
  organizationId: string;
}
