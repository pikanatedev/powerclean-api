import { Body, Controller, Get, Put } from '@nestjs/common';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('company')
export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Roles(Role.ADMIN)
  @Put()
  update(@Body() dto: UpdateCompanyDto) {
    return this.service.update(dto);
  }
}
