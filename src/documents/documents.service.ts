import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { existsSync } from 'fs';
import { CompanyService } from '../company/company.service';
import { TaxInvoicesService } from '../tax-invoices/tax-invoices.service';
import { GenerateReceiptDto } from './dto/generate-receipt.dto';
import { fillReceiptTemplate, fillTaxInvoiceTemplate } from './template-filler';

@Injectable()
export class DocumentsService {
  private readonly templatePath: string;

  constructor(
    private readonly companyService: CompanyService,
    private readonly taxInvoicesService: TaxInvoicesService,
    config: ConfigService,
  ) {
    const dir =
      config.get<string>('TEMPLATES_DIR') ??
      path.join(process.cwd(), 'templates');
    this.templatePath = path.join(dir, 'master.xlsx');
    if (!existsSync(this.templatePath)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[DocumentsService] template not found at ${this.templatePath}`,
      );
    }
  }

  async generateReceiptXlsx(dto: GenerateReceiptDto): Promise<{
    buffer: Buffer;
    filename: string;
  }> {
    const company = await this.companyService.get();
    const buffer = await fillReceiptTemplate(this.templatePath, dto, company);
    return { buffer, filename: `${dto.docNo}.xlsx` };
  }

  async generateTaxInvoiceXlsx(id: string): Promise<{
    buffer: Buffer;
    filename: string;
  }> {
    const [company, inv] = await Promise.all([
      this.companyService.get(),
      this.taxInvoicesService.findOne(id),
    ]);
    const buffer = await fillTaxInvoiceTemplate(this.templatePath, inv, company);
    return { buffer, filename: `${inv.docNo}.xlsx` };
  }
}
