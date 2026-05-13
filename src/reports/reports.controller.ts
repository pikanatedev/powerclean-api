import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SalesSummaryDto } from './dto/sales-summary.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('sales-summary')
  salesSummary(@Query() query: SalesSummaryDto) {
    return this.service.salesSummary(query);
  }
}
