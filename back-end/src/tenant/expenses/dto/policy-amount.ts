import { registerDecorator } from 'class-validator';

// DECIMAL(12,2): retain legacy numeric JSON support, but string input never
// passes through binary floating point on its way to PostgreSQL.
export function validPolicyAmount(value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text) || text.length > 64) return false;
  const [whole, fraction = ''] = text.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return cents > 0n && cents <= 999999999999n;
}

export function IsPolicyAmount(): PropertyDecorator {
  return (target, propertyKey) =>
    registerDecorator({
      name: 'isPolicyAmount',
      target: target.constructor,
      propertyName: String(propertyKey),
      validator: {
        validate: validPolicyAmount,
        defaultMessage: () =>
          'Spending cap must be positive, at most 9999999999.99, with up to two decimal places.',
      },
    });
}
