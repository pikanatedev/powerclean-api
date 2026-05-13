import { IsDateString, IsOptional } from 'class-validator';

export class SalesSummaryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
