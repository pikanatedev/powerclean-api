import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export type PaymentType = 'cash' | 'transfer' | 'cheque';

export class PaymentMethodDto {
  @IsIn(['cash', 'transfer', 'cheque'])
  type: PaymentType;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  transferDate?: string;

  @IsOptional()
  @IsString()
  chequeNo?: string;

  @IsOptional()
  @IsString()
  chequeDate?: string;
}

export class ReceiptCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(30)
  taxId: string;

  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class ReceiptItemDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class GenerateReceiptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  docNo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  refDocNo?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentMethodDto)
  paymentMethod?: PaymentMethodDto;

  @ValidateNested()
  @Type(() => ReceiptCustomerDto)
  customer: ReceiptCustomerDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemDto)
  items: ReceiptItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;
}
