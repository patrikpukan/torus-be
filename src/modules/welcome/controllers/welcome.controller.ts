import { Controller, Get, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Config } from 'src/shared/config/config.service';
import { WelcomeDto } from '../dto/welcome.dto';

@Controller()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class WelcomeController {
  constructor(private readonly config: Config) {}

  @Get('/')
  @ApiOperation({
    summary: 'Welcome message',
    description:
      'Welcome message including name, description, version and useful links',
  })
  async getWelcomeMessage(): Promise<WelcomeDto> {
    return {
      message: `Welcome to ${this.config.name}`,
      name: this.config.name,
      description: this.config.description,
      version: this.config.version,
      healthCheck: '/health',
      graphqlApi: '/graphql',
      restApi: '/api',
      authEndpointsDocs: '/api/auth/reference',
    };
  }
}
