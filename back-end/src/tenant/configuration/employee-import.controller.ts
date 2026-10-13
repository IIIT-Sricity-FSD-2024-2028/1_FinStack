import { TenantAuditContextInterceptor } from '../audit/tenant-audit-context';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { TenantRole } from '@prisma/client';
import { diskStorage } from 'multer';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { Response } from 'express';
import { Type, Transform } from 'class-transformer';
import {
  isUUID,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Public } from '../../platform/auth/decorators/public.decorator';
import { TenantAuthenticationGuard } from '../auth/guards/tenant-authentication.guard';
import { TenantRoleGuard } from '../auth/guards/tenant-role.guard';
import { TenantRoles } from '../auth/decorators/tenant-roles.decorator';
import { TenantRequest } from '../auth/tenant-auth.types';
import { EmployeeImportService } from './employee-import.service';
import { EmployeeActivationService } from './employee-activation.service';
import { csvCell, IMPORT_HEADERS } from './employee-import-validation';

class ImportPageDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
}
class ActivateEmployeeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/)
  employeeId: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) token: string;
  @IsString() @MinLength(8) @MaxLength(200) password: string;
}

@UseInterceptors(TenantAuditContextInterceptor)
@Controller('configuration/employee-imports')
@UseGuards(TenantAuthenticationGuard, TenantRoleGuard)
@TenantRoles(TenantRole.CONFIGURATION_MANAGER)
export class EmployeeImportController {
  constructor(
    private readonly imports: EmployeeImportService,
    private readonly activation: EmployeeActivationService,
  ) {}
  @Get('template') template() {
    return new StreamableFile(Buffer.from(IMPORT_HEADERS.join(',') + '\r\n'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="employee-import-template.csv"',
    });
  }
  @Get() list(@Req() req: TenantRequest) {
    return this.imports.list(req.tenantAuth!.organizationId);
  }
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, _file, cb) =>
          cb(null, 'finstack-employee-import-' + randomUUID() + '.csv'),
      }),
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  async upload(
    @Req() req: TenantRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('idempotency-key') key: string,
  ) {
    if (!isUUID(key)) {
      if (file) await unlink(file.path).catch(() => undefined);
      throw new BadRequestException(
        'A UUID idempotency-key header is required.',
      );
    }
    return this.imports.upload(req.tenantAuth!, file, key);
  }
  @Get(':id') get(
    @Req() req: TenantRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.imports.get(req.tenantAuth!.organizationId, id);
  }
  @Get(':id/rows') rows(
    @Req() req: TenantRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ImportPageDto,
  ) {
    return this.imports.rows(req.tenantAuth!.organizationId, id, query.page);
  }
  @Post(':id/confirm') confirm(
    @Req() req: TenantRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.imports.confirm(req.tenantAuth!, id);
  }
  @Post(':id/activation-links') links(
    @Req() req: TenantRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.activation.issue(req.tenantAuth!.organizationId, id);
  }
  @Get(':id/errors') async errors(
    @Req() req: TenantRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const org = req.tenantAuth!.organizationId;
    const job = await this.imports.get(org, id);
    const imports = this.imports;
    async function* stream() {
      yield 'rowNumber,employeeId,email,status,errors\r\n';
      for (let page = 1; page <= Math.ceil(job.totalCount / 100); page++) {
        const rows = await imports.rows(org, id, page);
        for (const row of rows)
          if (row.errors.length)
            yield [
              String(row.rowNumber),
              row.employeeId,
              row.email,
              row.status,
              row.errors.join('; '),
            ]
              .map(csvCell)
              .join(',') + '\r\n';
      }
    }
    return new StreamableFile(Readable.from(stream()), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="employee-import-errors.csv"',
    });
  }
}

@Controller('employee-activation')
export class EmployeeActivationController {
  constructor(private readonly activation: EmployeeActivationService) {}
  @Public()
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  activate(@Body() dto: ActivateEmployeeDto) {
    return this.activation.activate(dto.employeeId, dto.token, dto.password);
  }
}
