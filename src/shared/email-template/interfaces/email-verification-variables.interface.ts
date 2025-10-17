import { TemplateVariableValue } from './compilable-template.interface';

export interface EmailVerificationTemplateVariables
  extends Record<string, TemplateVariableValue> {
  url: string;
}
