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
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('tax-invoices')
export class TaxInvoicesController {
  constructor(private readonly service: TaxInvoicesService) {}

  @RequirePermission('tax-invoices', 'view')
  @Get()
  list(@Query() query: ListTaxInvoiceDto) {
    return this.service.list(query);
  }

  @RequirePermission('tax-invoices', 'view')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermission('tax-invoices', 'create')
  @Post()
  create(@Body() dto: CreateTaxInvoiceDto) {
    return this.service.create(dto);
  }

  @RequirePermission('tax-invoices', 'update')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxInvoiceDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermission('tax-invoices', 'delete')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
