import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PlatformRequest } from '../auth.types';

export const CurrentPlatformAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<PlatformRequest>().platformAuth,
);

export const CurrentPlatformRefresh = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<PlatformRequest>().platformRefreshAuth,
);

export const CurrentPlatformStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<PlatformRequest>().platformAuth?.staff,
);
