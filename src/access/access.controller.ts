import { Controller, Get, Query } from '@nestjs/common';
import { CheckAccessDto } from './dto/check-access.dto';
import { AccessService } from './access.service';

@Controller('access')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get('check')
  check(@Query() query: CheckAccessDto) {
    return this.accessService.check(query.email, query.slug);
  }
}
