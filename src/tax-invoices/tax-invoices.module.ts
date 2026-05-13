import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxInvoice } from './tax-invoice.entity';
import { TaxInvoiceItem } from './tax-invoice-item.entity';
import { TaxInvoicesService } from './tax-invoices.service';
import { TaxInvoicesController } from './tax-invoices.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TaxInvoice, TaxInvoiceItem])],
  controllers: [TaxInvoicesController],
  providers: [TaxInvoicesService],
  exports: [TaxInvoicesService],
})
export class TaxInvoicesModule {}
