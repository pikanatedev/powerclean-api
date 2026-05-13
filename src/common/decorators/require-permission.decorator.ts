import { SetMetadata } from '@nestjs/common';
import type { Action, Resource } from '../../permissions/permission.constants';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  resource: Resource;
  action: Action;
}

export const RequirePermission = (resource: Resource, action: Action) =>
  SetMetadata(PERMISSION_KEY, { resource, action });
