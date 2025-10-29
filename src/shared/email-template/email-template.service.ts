import * as fs from "fs/promises";
import * as path from "path";
import { Injectable } from "@nestjs/common";
import Handlebars from "handlebars";
import {
  CompilableTemplate,
  TemplateVariableValue,
} from "./interfaces/compilable-template.interface";

@Injectable()
export class EmailTemplateService {
  private readonly templateDirectories: string[] = [
    // Prefer project root assets (works in dev and prod after copying assets)
    path.resolve(process.cwd(), "assets/templates/html"),
    // Fallback for environments where templates remain alongside compiled sources
    path.resolve(__dirname, "../../../assets/templates/html"),
    path.resolve(__dirname, "../../../../assets/templates/html"),
  ];

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
      const filePath = await this.resolveTemplatePath(templatePath);
      const htmlTemplate = await fs.readFile(filePath, "utf8");
      const handlebarsTemplate = Handlebars.compile(htmlTemplate);
      const filledTemplate = handlebarsTemplate(variables);
      return filledTemplate;
    } catch (error) {
      console.error("Error compiling template:", error);
      throw new Error("Failed to read or compile email template.");
    }
  }

  private async resolveTemplatePath(templatePath: string): Promise<string> {
    for (const basePath of this.templateDirectories) {
      const candidate = path.resolve(basePath, templatePath);

      try {
        await fs.access(candidate);
        return candidate;
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
          throw err;
        }
      }
    }

    throw new Error(`Template not found: ${templatePath}`);
  }
}
