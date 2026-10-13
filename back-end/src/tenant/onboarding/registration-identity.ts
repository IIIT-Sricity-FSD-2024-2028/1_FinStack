import { BadRequestException } from '@nestjs/common';
import { domainToASCII } from 'node:url';
import { organizationDomain } from '../../platform/organizations/organization-domain';
import { RegisterOrganizationDto } from './dto/register-organization.dto';

export function registrationIdentity(
  dto: RegisterOrganizationDto,
  allowTestDomains = false,
) {
  const fail = (field: string, message: string): never => {
    throw new BadRequestException({
      code: 'REGISTRATION_INVALID',
      message,
      field,
    });
  };
  for (const field of [
    'name',
    'firstName',
    'lastName',
    'authorizedContactTitle',
  ] as const) {
    if (!dto[field].trim() || /[\p{Cc}\p{Cf}<>]/u.test(dto[field]))
      fail(
        field,
        'Enter meaningful text without control characters or markup.',
      );
  }
  const primaryEmail = dto.primaryEmail.trim().toLowerCase();
  const email = dto.email.trim().toLowerCase();
  const domain = organizationDomain(primaryEmail, allowTestDomains);
  if (!domain)
    fail(
      'primaryEmail',
      'Use an official organization email with a publicly usable organization domain.',
    );
  if (domainToASCII(email.split('@')[1] || '').toLowerCase() !== domain)
    fail(
      'email',
      'Use an authorized contact email on the same organization domain.',
    );
  const identifier = dto.registrationIdentifier?.normalize('NFKC').trim();
  const exemption = dto.registrationExemptionReason?.trim();
  if (Boolean(identifier) === Boolean(exemption))
    fail(
      'registrationIdentifier',
      'Provide a legal registration identifier or explain why one is not applicable, but not both.',
    );
  if (
    identifier &&
    (!/^[\p{L}\p{N}][\p{L}\p{N} ._/()&:-]{0,159}$/u.test(identifier) ||
      !/[\p{L}\p{N}]/u.test(identifier))
  )
    fail(
      'registrationIdentifier',
      'Enter the identifier as issued, using letters, numbers and ordinary identifier punctuation.',
    );
  if (
    exemption &&
    (exemption.length < 10 || /[\p{Cc}\p{Cf}<>]/u.test(exemption))
  )
    fail(
      'registrationExemptionReason',
      'Explain why registration is not applicable in at least 10 characters.',
    );
  // Conservative canonicalization; an Admin reviews legal meaning, never inferred here.
  const key = identifier?.toUpperCase().replace(/[ ._/()&:-]/g, '') || null;
  return {
    primaryEmail,
    email,
    normalizedDomain: domain!,
    registrationIdentifier: identifier || null,
    registrationIdentifierKey: key,
    registrationExemptionReason: exemption || null,
  };
}
