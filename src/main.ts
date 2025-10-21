import {NestFactory} from '@nestjs/core';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import {AppModule} from './app.module';
import {AuthHttpRouter} from './shared/auth/http/auth-http.router';
import {Config} from './shared/config/config.service';
import {AppLoggerService} from './shared/logger/logger.service';

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
  const corsOrigins = [config.baseUrl, config.frontendBaseUrl, config.frontendProdUrl].filter(
    (origin): origin is string => typeof origin === 'string',
  );
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : '*',
    credentials: true,
  });

  // Setup GraphQL file upload middleware
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 5 }));

  // Setup cookie parser middleware
  app.use(cookieParser());

  const appInstance = app.getHttpAdapter().getInstance();
  appInstance.use(express.json());
  const authHttpRouter = app.get(AuthHttpRouter);
  appInstance.use('/api/auth', authHttpRouter.buildRouter());

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
  console.log('App configuration:', {
    nodeEnv: config.nodeEnv || process.env.NODE_ENV,
    port: config.port,
    baseUrl: config.baseUrl,
    frontendBaseUrl: config.frontendBaseUrl,
    database: config.postgresConnectionString?.split('@')[1]?.split('/')[0] || 'not configured',
  });

  // Start the application
  await app.listen(config.port || 4000);
  
  logger.log(`🚀 Application is running on: ${config.baseUrl || `http://localhost:${config.port || 4000}`}`);
  logger.log(`📊 GraphQL Playground: ${config.baseUrl || `http://localhost:${config.port || 4000}`}/graphql`);
  logger.log(`📚 API Documentation: ${config.baseUrl || `http://localhost:${config.port || 4000}`}/docs`);
  logger.log(`🗄️  Database: ${config.databaseProvider} (${config.postgresConnectionString?.includes('supabase') ? 'Supabase' : 'Local'})`);
}

// Execute the main function
main().catch((error) => console.error('Application error:', error));
