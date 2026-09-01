import { ApiError } from '../../services/api/client';

const businessMessages: Record<string, string> = {
  LAST_EFFECTIVE_SUPER_ADMIN:
    'The final effective Super Admin cannot lose access.',
  EFFECTIVE_SUPER_ADMIN_REQUIRED:
    'An active Super Admin must perform this action.',
  ROLE_ASSIGNMENT_EXCEEDS_ACTOR_AUTHORITY:
    'You can only assign roles whose permissions you currently have.',
  ROLE_REACTIVATION_EXCEEDS_ACTOR_AUTHORITY:
    'You can only reactivate roles whose permissions you currently have.',
  STAFF_REACTIVATION_EXCEEDS_ACTOR_AUTHORITY:
    'This staff member would regain permissions outside your authority.',
  PERMISSION_GRANT_NOT_ALLOWED:
    'You can only grant permissions that you currently have.',
  SYSTEM_PLATFORM_ROLE_IMMUTABLE:
    'System roles are managed by FinStack and cannot be changed here.',
  PLATFORM_ROLE_INACTIVE: 'Inactive roles cannot receive new assignments.',
  PLATFORM_STAFF_ROLE_ASSIGNMENT_SUSPENDED:
    'Roles cannot be assigned to suspended staff.',
  PLATFORM_STAFF_SELF_DEACTIVATION:
    'You cannot deactivate your own platform staff account.',
  PLATFORM_STAFF_EMAIL_CONFLICT:
    'A platform staff member with this email already exists.',
  PLATFORM_ROLE_UNIQUE_CONSTRAINT:
    'A role with this key or name already exists.',
};

export function adminErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.code) {
    return businessMessages[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function formatAdminDate(value: string | null): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function permissionGroup(key: string): string {
  const [domain, resource] = key.split('.');
  const label = resource || domain;
  return label.charAt(0).toUpperCase() + label.slice(1);
}
