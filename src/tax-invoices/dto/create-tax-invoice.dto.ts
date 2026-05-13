import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateTaxInvoiceItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsNumber()
  @Min(0)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateTaxInvoiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  docNo: string;

  @IsDateString()
  date: string;

  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  refDocNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  poNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentTerms?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsBoolean()
  cancelled?: boolean;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CreateTaxInvoiceItemDto)
  items: CreateTaxInvoiceItemDto[];
}
