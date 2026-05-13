import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { CompanyModule } from '../company/company.module';
import { TaxInvoicesModule } from '../tax-invoices/tax-invoices.module';

@Module({
  imports: [CompanyModule, TaxInvoicesModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
