import { domainToASCII, domainToUnicode } from 'node:url';
import { isFQDN } from 'class-validator';
const personal = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
]);
// Domain claims apply to organization domains, never to shared personal providers.
export function organizationDomain(
  email: string,
  allowTestDomains = false,
): string | null {
  const domain = domainToASCII(email.trim().split('@')[1] || '').toLowerCase();
  return isFQDN(domain) &&
    !personal.has(domain) &&
    (!/(?:^|\.)(?:test|example|invalid|localhost)$/.test(domain) ||
      (allowTestDomains && domain.endsWith('.test')))
    ? domain
    : null;
}

export function organizationDomainAliases(domain: string): string[] {
  return [...new Set([domain, domainToUnicode(domain)])];
}
