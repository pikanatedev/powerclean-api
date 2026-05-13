import { Body, Controller, Get, Put } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  RESOURCE_ACTIONS,
  RESOURCE_LABELS,
  RESOURCES,
} from './permission.constants';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  /**
   * Returns full matrix + metadata (resource catalog, labels, applicable actions).
   * UI ใช้ generate ตาราง matrix
   */
  @RequirePermission('permissions', 'view')
  @Get()
  async get() {
    const entries = await this.service.getMatrix();
    return {
      resources: RESOURCES,
      resourceLabels: RESOURCE_LABELS,
      resourceActions: RESOURCE_ACTIONS,
      entries,
    };
  }

  @RequirePermission('permissions', 'update')
  @Put()
  async update(@Body() dto: UpdatePermissionsDto) {
    return this.service.updateMatrix(dto.entries);
  }
}
