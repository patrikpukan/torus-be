import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const provider = args[0]?.toLowerCase();

if (!provider || !['mysql', 'sqlite'].includes(provider)) {
  console.error('Usage: npm run switch-db [mysql|sqlite]');
  process.exit(1);
}

const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
let schemaContent = fs.readFileSync(schemaPath, 'utf8');

let newDatasource: string;
let newEnvUrl: string;

if (provider === 'mysql') {
  newDatasource = `datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}`;
  newEnvUrl =
    'DATABASE_URL="mysql://quackerUser:quackerPassword@localhost:3306/quacker"';
} else {
  newDatasource = `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`;
  newEnvUrl = 'DATABASE_URL="file:./prisma/dev.db"';
}

// Replace datasource in schema.prisma
const datasourceRegex = /datasource\s+db\s+{[^}]+}/;
schemaContent = schemaContent.replace(datasourceRegex, newDatasource);
fs.writeFileSync(schemaPath, schemaContent);

// Update .env file
const envPath = path.resolve(__dirname, '../../.env');
let envContent = '';

try {
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');

    // Replace DATABASE_URL if it exists
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(/DATABASE_URL=.*/, newEnvUrl);
    } else {
      // Add DATABASE_URL if it doesn't exist
      envContent += `\n${newEnvUrl}`;
    }
  } else {
    // Create .env file if it doesn't exist
    envContent = newEnvUrl;
  }

  fs.writeFileSync(envPath, envContent);
} catch (error) {
  console.error('Error updating .env file:', error);
}

console.log(`Switched database provider to ${provider}`);
console.log('Run the following commands to update your database:');
console.log('1. npx prisma generate');

if (provider === 'mysql') {
  console.log('2. npm run db:migrate:mysql');
} else {
  console.log('2. npx prisma db push');
}
