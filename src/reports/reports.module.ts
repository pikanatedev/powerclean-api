import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxInvoice } from '../tax-invoices/tax-invoice.entity';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TaxInvoice, Customer, Product])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
