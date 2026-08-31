import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersRepository } from '../users/users.repository';
import { TenantLoginDto } from './dto/tenant-login.dto';

@Injectable()
export class TenantAuthService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: TenantLoginDto) {
    const users = this.usersRepo.findAll();
    const user = users.find(
      (u) => u.organizationId === dto.organizationId &&
             u.employeeId === dto.employeeId &&
             u.password === dto.password &&
             u.status !== 'Inactive' &&
             u.accountStatus === 'approved'
    );
    if (!user) {
      throw new UnauthorizedException('Invalid organization ID, employee ID, or password');
    }
    const roles = Array.isArray(user.roles) ? user.roles : (user.roles ? [user.roles] : []);
    const payload = {
      sub: user.id,
      employeeId: user.employeeId,
      organizationId: user.organizationId,
      roles: roles,
    };
    return {
      accessToken: await this.jwtService.signAsync(payload, {
        secret: process.env.TENANT_JWT_SECRET || 'fallback_tenant_secret',
        expiresIn: '8h'
      }),
      user,
    };
  }
}
