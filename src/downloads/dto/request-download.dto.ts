import { IsEmail, IsString } from 'class-validator';

export class RequestDownloadDto {
  @IsEmail()
  email!: string;

  @IsString()
  slug!: string;
}
