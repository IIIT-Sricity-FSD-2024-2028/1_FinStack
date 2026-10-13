import {
  IsIn,
  IsString,
  Length,
  Matches,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsInt,
} from 'class-validator';
export class OrganizationSettingsDto {
  @IsIn([
    '',
    '1-10 employees',
    '11-50 employees',
    '51-200 employees',
    '201-500 employees',
    '500+ employees',
  ])
  companySize!: string;
  @IsIn(['January', 'April', 'July', 'October']) fiscalYearStart!: string;
  @IsIn(['Bank Transfer', 'Corporate Card', 'Check'])
  defaultPaymentMethod!: string;
}
export class ProfileSettingsDto {
  @IsString() @Length(1, 201) fullName!: string;
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[+()\d .-]*$/)
  phone?: string;
  @IsOptional() @IsString() @MaxLength(180) location?: string;
  @IsOptional()
  @IsIn(['#7C3AED', '#22D3EE', '#EC4899', '#10B981'])
  avatarColor?: string;
}
export class TenantPreferencesDto {
  @IsIn(['dark', 'light', 'system']) theme!: string;
  @IsBoolean() compactMode!: boolean;
  @IsBoolean() animations!: boolean;
  @IsIn(['en-US', 'en-GB']) language!: string;
  @IsIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']) dateFormat!: string;
  @IsIn([
    'Asia/Kolkata',
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'UTC',
  ])
  timezone!: string;
  @IsIn(['en-US', 'de-DE', 'fr-FR']) numberLocale!: string;
  @IsBoolean() desktopNotifications!: boolean;
  @IsIn(['dashboard', 'notifications', 'audit-logs']) defaultView!: string;
  @IsInt() @IsIn([10, 25, 50, 100]) pageSize!: number;
  @IsBoolean() autoRefresh!: boolean;
}
export class ChangeOwnPasswordDto {
  @IsString() @Length(1, 200) currentPassword!: string;
  @IsString()
  @Length(12, 128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
  newPassword!: string;
  @IsString() @Length(12, 128) confirmPassword!: string;
}
