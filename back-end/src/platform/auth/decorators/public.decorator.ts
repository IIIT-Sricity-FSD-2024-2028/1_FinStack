import { SetMetadata } from '@nestjs/common';
import { PLATFORM_PUBLIC_KEY } from '../auth.constants';

export const Public = () => SetMetadata(PLATFORM_PUBLIC_KEY, true);
