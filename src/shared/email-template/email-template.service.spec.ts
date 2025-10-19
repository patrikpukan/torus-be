import { EmailTemplateService } from './email-template.service';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  it('compiles verify email template with provided url', async () => {
    const url = 'https://example.com/verify?token=123';

    const html = await service.compileTemplate({
      templatePath: 'verify-email.html',
      variables: { url },
    });

  expect(html).toContain('https://example.com/verify?token');
    expect(html).toContain('Verify');
  });

  it('throws helpful error when template is missing', async () => {
    await expect(
      service.compileTemplate({ templatePath: 'missing-template.html', variables: {} }),
    ).rejects.toThrow('Failed to read or compile email template.');
  });
});
