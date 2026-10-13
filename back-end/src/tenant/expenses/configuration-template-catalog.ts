// Stable machine keys are never reused. Retired definitions remain resolvable in
// a new catalog version; activation never overwrites organization-owned records.
export const CONFIGURATION_CATALOG_VERSION = '2026-10-10.v1';
export const CATEGORY_TEMPLATES = [
  {
    key: 'travel',
    name: 'Travel',
    description: 'Business airfare, rail, taxis and other transport.',
    color: '#7C3AED',
  },
  {
    key: 'meals',
    name: 'Meals',
    description: 'Business meals and approved refreshments.',
    color: '#EC4899',
  },
  {
    key: 'accommodation',
    name: 'Accommodation',
    description: 'Hotels and lodging during business travel.',
    color: '#22D3EE',
  },
  {
    key: 'fuel-mileage',
    name: 'Fuel/Mileage',
    description: 'Business vehicle fuel and mileage reimbursement.',
    color: '#F59E0B',
  },
  {
    key: 'office-supplies',
    name: 'Office Supplies',
    description: 'Stationery and consumable workplace supplies.',
    color: '#10B981',
  },
  {
    key: 'equipment',
    name: 'Equipment',
    description: 'Business devices, accessories and approved equipment.',
    color: '#6366F1',
  },
  {
    key: 'training',
    name: 'Training',
    description: 'Professional courses, conferences and learning materials.',
    color: '#14B8A6',
  },
  {
    key: 'communication-internet',
    name: 'Communication/Internet',
    description: 'Business phone, mobile data and internet charges.',
    color: '#A855F7',
  },
] as const;
export const POLICY_TEMPLATES = CATEGORY_TEMPLATES.map((category) => ({
  key: `${category.key}-policy`,
  categoryKey: category.key,
  name: `${category.name} policy`,
  description: `${category.description} Apply only to authorized business expenses. Review the per-expense cap, receipt evidence and approval requirements before activation.`,
  receiptRequired: true,
  approvalLevels: 2,
  // No monetary suggestion is supplied: the organization must explicitly enter a cap.
  maxAmount: null,
}));
export const CONFIGURATION_CATALOG = {
  version: CONFIGURATION_CATALOG_VERSION,
  categories: CATEGORY_TEMPLATES,
  policies: POLICY_TEMPLATES,
  approvalOptions: [
    { levels: 0, label: 'Auto Approved' },
    { levels: 1, label: 'Manager Approval' },
    { levels: 2, label: 'Manager + Finance' },
  ],
};
