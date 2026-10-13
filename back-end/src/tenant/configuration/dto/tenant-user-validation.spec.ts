import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTenantUserDto } from './create-tenant-user.dto';
import { UpdateTenantUserDto } from './update-tenant-user.dto';
const valid = {
  employeeId: ' QA-1 ',
  firstName: ' Alex ',
  lastName: ' Tester ',
  email: ' alex@example.test ',
  initialPassword: 'QA-password-1',
  role: 'MANAGER',
  department: 'Engineering',
};
describe('manual provisioning validation', () => {
  it('trims names, email and globally unique login identity before validation', async () => {
    const dto = plainToInstance(CreateTenantUserDto, valid);
    expect(await validate(dto)).toEqual([]);
    expect(dto.firstName).toBe('Alex');
    expect(dto.employeeId).toBe('QA-1');
  });
  it('rejects whitespace names, control characters, invalid identities, roles and passwords', async () => {
    for (const [field, value] of [
      ['firstName', '   '],
      ['lastName', 'a\u0000b'],
      ['firstName', 'x'.repeat(101)],
      ['email', 'bad'],
      ['employeeId', 'bad id'],
      ['department', 'a\u0001b'],
      ['initialPassword', 'short'],
      ['role', 'ADMINISTRATOR'],
    ]) {
      expect(
        (
          await validate(
            plainToInstance(CreateTenantUserDto, { ...valid, [field]: value }),
          )
        ).some((e) => e.property === field),
      ).toBe(true);
    }
  });
  it('validates optional profile updates, including null and whitespace rejection', async () => {
    expect(
      await validate(
        plainToInstance(UpdateTenantUserDto, {
          firstName: ' Alex ',
          department: '',
        }),
      ),
    ).toEqual([]);
    for (const value of [null, '   ', 'a\u0000b'])
      expect(
        (
          await validate(
            plainToInstance(UpdateTenantUserDto, { firstName: value }),
          )
        ).length,
      ).toBeGreaterThan(0);
  });
});
