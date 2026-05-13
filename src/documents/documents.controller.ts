import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { GenerateReceiptDto } from './dto/generate-receipt.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function setDownload(res: Response, filename: string, buffer: Buffer) {
  res.set({
    'Content-Type': XLSX_MIME,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length.toString(),
  });
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @RequirePermission('documents', 'view')
  @Post('receipt')
  async generateReceipt(
    @Body() dto: GenerateReceiptDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.service.generateReceiptXlsx(dto);
    setDownload(res, filename, buffer);
    return new StreamableFile(buffer);
  }

  @RequirePermission('documents', 'view')
  @Get('tax-invoice/:id/xlsx')
  async generateTaxInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.service.generateTaxInvoiceXlsx(id);
    setDownload(res, filename, buffer);
    return new StreamableFile(buffer);
  }
}
