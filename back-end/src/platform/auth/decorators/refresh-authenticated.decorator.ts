import { SetMetadata } from '@nestjs/common';
import { PLATFORM_REFRESH_AUTH_KEY } from '../auth.constants';

export const RefreshAuthenticated = () =>
  SetMetadata(PLATFORM_REFRESH_AUTH_KEY, true);
