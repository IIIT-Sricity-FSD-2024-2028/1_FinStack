import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTenantPolicyDto } from './create-tenant-policy.dto';
import { PolicyTemplateSelectionDto } from './activate-configuration-templates.dto';
import { validPolicyAmount } from './policy-amount';
describe('policy decimal contract', () => {
  it('accepts exact positive decimals and existing numeric JSON', () => {
    for (const value of [
      '500',
      '2000',
      '5000',
      '5000.50',
      '7500.75',
      '7500.50',
      '0.01',
      '9999999999.99',
      125.75,
    ])
      expect(validPolicyAmount(value)).toBe(true);
  });
  it('rejects zero, negatives, overflow, excess precision and malformed values', () => {
    for (const value of [
      '0',
      '0.00',
      '-1',
      '1.001',
      '10000000000',
      '1e3',
      'NaN',
      '',
      ' 500 ',
      null,
      {},
      Infinity,
    ])
      expect(validPolicyAmount(value)).toBe(false);
  });
  it('enforces both manual and template DTOs independently', async () => {
    const base = {
      name: 'Test',
      categoryId: '10000000-0000-4000-8000-000000000001',
      templateKey: 'meals-policy',
      currency: 'INR',
      receiptRequired: true,
      approvalLevels: 0,
    };
    for (const instance of [
      plainToInstance(CreateTenantPolicyDto, { ...base, maxAmount: '7500.50' }),
      plainToInstance(PolicyTemplateSelectionDto, {
        ...base,
        maxAmount: '7500.50',
      }),
    ]) {
      expect((await validate(instance)).length).toBe(0);
      instance.maxAmount = '0';
      expect(
        (await validate(instance)).some(
          (error) => error.property === 'maxAmount',
        ),
      ).toBe(true);
    }
  });
});
