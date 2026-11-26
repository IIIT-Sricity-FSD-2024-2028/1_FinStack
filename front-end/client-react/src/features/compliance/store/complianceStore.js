// Identity helper retained from the feature migration. The root store owns the
// credential guard, middleware, and lifecycle for every actor.
export function complianceIdentity(user, organizationId = user?.organizationId) {
  return user?.id && organizationId && user.role === 'COMPLIANCE_OFFICER' && user.status === 'ACTIVE'
    ? JSON.stringify([organizationId, user.id, user.role]) : null
}
