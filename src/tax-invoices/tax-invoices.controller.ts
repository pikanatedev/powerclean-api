import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TaxInvoicesService } from './tax-invoices.service';
import { CreateTaxInvoiceDto } from './dto/create-tax-invoice.dto';
import { UpdateTaxInvoiceDto } from './dto/update-tax-invoice.dto';
import { ListTaxInvoiceDto } from './dto/list-tax-invoice.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('tax-invoices')
export class TaxInvoicesController {
  constructor(private readonly service: TaxInvoicesService) {}

  @Get()
  list(@Query() query: ListTaxInvoiceDto) {
    return this.service.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTaxInvoiceDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxInvoiceDto,
  ) {
    return this.service.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
