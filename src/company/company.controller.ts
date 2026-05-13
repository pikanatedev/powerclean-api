import { Body, Controller, Get, Put } from '@nestjs/common';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('company')
export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  @RequirePermission('company', 'view')
  @Get()
  get() {
    return this.service.get();
  }

  @RequirePermission('company', 'update')
  @Put()
  update(@Body() dto: UpdateCompanyDto) {
    return this.service.update(dto);
  }
}
