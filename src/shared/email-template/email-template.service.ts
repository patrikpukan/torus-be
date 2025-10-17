import * as fs from 'fs/promises';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';
import {
  CompilableTemplate,
  TemplateVariableValue,
} from './interfaces/compilable-template.interface';

@Injectable()
export class EmailTemplateService {
  private readonly TEMPLATE_BASE_PATH = path.resolve(
    __dirname,
    '../../../assets/templates/html/',
  );

  /**
   * Compiles an email template with provided variables
   * @param templatePath - Path to the template file
   * @param variables - Variables to inject into the template
   * @returns Compiled HTML template as string
   */
  async compileTemplate<T extends Record<string, TemplateVariableValue>>({
    templatePath,
    variables,
  }: CompilableTemplate<T>): Promise<string> {
    try {
      const filePath = path.resolve(this.TEMPLATE_BASE_PATH, templatePath);
      const htmlTemplate = await fs.readFile(filePath, 'utf8');
      const handlebarsTemplate = Handlebars.compile(htmlTemplate);
      const filledTemplate = handlebarsTemplate(variables);
      return filledTemplate;
    } catch (error) {
      console.error('Error compiling template:', error);
      throw new Error('Failed to read or compile email template.');
    }
  }
}
