import { existsSync } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

// All paths passed to this module should be absolute, resolved from the project root, not relative to __dirname.

export const seedDirToStorage = async (
  localDirectoryPath: string,
  uploadDirectoryPath: string,
): Promise<Array<{ name: string; size: number }>> => {
  try {
    // Ensure upload directory exists
    if (!existsSync(uploadDirectoryPath)) {
      await mkdir(uploadDirectoryPath, { recursive: true });
    } else {
      // Clear the upload directory
      const existingFiles = await readdir(uploadDirectoryPath);
      await Promise.all(
        existingFiles.map(async (file) => {
          await rm(join(uploadDirectoryPath, file), { force: true });
        }),
      );
    }

    // Get all files in the source folder
    const files = await readdir(localDirectoryPath);

    const filesObject = await Promise.all(
      files.map(async (file) => {
        const filePath = join(localDirectoryPath, file);
        const fileStat = await stat(filePath);
        return {
          name: file,
          size: fileStat.size,
        };
      }),
    );

    // Copy all files to the upload directory
    await Promise.all(
      files.map(async (file) => {
        const sourcePath = join(localDirectoryPath, file);
        const destinationPath = join(uploadDirectoryPath, file);

        const fileContent = await readFile(sourcePath);
        await writeFile(destinationPath, fileContent);

        return file;
      }),
    );

    console.log(
      `Successfully copied ${files.length} files to ${uploadDirectoryPath}`,
    );
    return filesObject;
  } catch (error) {
    console.error('Error copying files to upload directory:', error);
    throw error;
  }
};
