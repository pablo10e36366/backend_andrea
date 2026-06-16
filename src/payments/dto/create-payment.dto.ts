import { IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  orderId!: string;

  @IsString()
  provider!: string;

  @IsOptional()
  @IsString()
  providerRef?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
