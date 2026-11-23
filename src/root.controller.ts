import { Controller, Get, Redirect } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';

/** Sends anyone opening the base URL to the API docs (or `/health`). */
@ApiExcludeController()
@Controller()
export class RootController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @Redirect()
  root(): { url: string } {
    return {
      url: this.config.get<boolean>('ENABLE_SWAGGER') ? '/api' : '/health',
    };
  }
}
