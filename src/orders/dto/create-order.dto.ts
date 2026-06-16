import { IsEmail, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsString()
  productId!: string;

  @IsString()
  status!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
