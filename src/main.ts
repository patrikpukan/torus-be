import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import { AppModule } from './app.module';
import { BetterAuth } from './shared/auth/providers/better-auth.provider';
import { Config } from './shared/config/config.service';
import { AppLoggerService } from './shared/logger/logger.service';

/**
 * Main application entry point
 * Initializes and configures the NestJS application
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until we set up our custom logger
    logger: false, // Disable default logger initially
  });

  const logger = app.get(AppLoggerService);
  app.useLogger(logger);
  app.flushLogs(); // Flush any buffered logs through our custom logger

  // Get configuration service
  const config = app.get(Config);

  // Configure CORS - Allows cross-origin requests from specific origins
  app.enableCors({
    origin: [config.baseUrl, config.frontendBaseUrl, config.frontendProdUrl],
    credentials: true,
  });

  // Setup GraphQL file upload middleware
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 5 }));

  // Setup cookie parser middleware
  app.use(cookieParser());

  const appInstance = app.getHttpAdapter().getInstance();
  const betterAuth = app.get<BetterAuth>('BetterAuth');
  appInstance.all('/api/auth/*', toNodeHandler(betterAuth));
  appInstance.use(express.json());

  // Configure API prefix for all routes
  app.setGlobalPrefix('api');

  // Setup Swagger API documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle(config.name)
    .setDescription(config.description)
    .setVersion(config.version)
    .addServer('/api')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Print debug information for development purposes
  if (config.nodeEnv !== 'production') {
    console.log('App configuration:', {
      nodeEnv: config.nodeEnv,
      port: config.port,
      baseUrl: config.baseUrl,
      frontendBaseUrl: config.frontendBaseUrl,
    });
  }

  // Start the application
  await app.listen(config.port);
  console.log(`Application is running on: ${config.baseUrl}`);
}

// Execute the main function
main().catch((error) => console.error('Application error:', error));
