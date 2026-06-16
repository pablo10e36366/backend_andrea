import { IsEmail, IsString } from 'class-validator';

export class CheckAccessDto {
  @IsEmail()
  email!: string;

  @IsString()
  slug!: string;
}
