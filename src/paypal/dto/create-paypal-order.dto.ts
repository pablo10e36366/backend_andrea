import { IsString } from 'class-validator';

export class CreatePaypalOrderDto {
  @IsString()
  orderId!: string;
}
