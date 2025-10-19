/**
 * Represents a value that can be used in email template compilation
 */
export type TemplateVariableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TemplateVariableValue[]
  | { [key: string]: TemplateVariableValue };

/**
 * Interface for compilable email template with variables
 */
export interface CompilableTemplate<
  T extends Record<string, TemplateVariableValue> = Record<
    string,
    TemplateVariableValue
  >,
> {
  templatePath: string;
  variables: T;
}
