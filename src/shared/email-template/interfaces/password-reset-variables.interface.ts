import { TemplateVariableValue } from './compilable-template.interface';

export interface PasswordResetTemplateVariables
  extends Record<string, TemplateVariableValue> {
  username: string;
  url: string;
}
