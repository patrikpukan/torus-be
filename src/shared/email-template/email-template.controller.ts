import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EmailTemplateService } from './email-template.service';
import { EmailVerificationTemplateVariables } from './interfaces/email-verification-variables.interface';

@Controller('email-template-previews')
@ApiTags('email templates')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class EmailTemplateController {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Get('email-verification')
  @ApiOperation({ summary: 'Preview the verification email template' })
  @ApiQuery({
    name: 'url',
    type: String,
    description: 'URL for the verification link',
    required: true,
  })
  async previewVerificationEmail(@Query('url') url: string): Promise<string> {
    const html =
      await this.emailTemplateService.compileTemplate<EmailVerificationTemplateVariables>(
        {
          templatePath: 'verify-email.html',
          variables: { url },
        },
      );
    return html;
  }
}
