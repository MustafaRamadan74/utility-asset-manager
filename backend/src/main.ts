import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global API route prefix
  app.setGlobalPrefix('api');

  // Global DTO validation pipe (D5)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS with origin from environment
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Swagger Documentation setup at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Utility Asset Manager API')
    .setDescription(
      'Web GIS REST API for water utility asset management, spatial queries, and topological validation.',
    )
    .setVersion('1.0')
    .addTag('Health', 'Health and connectivity check')
    .addTag('Assets', 'Utility assets CRUD and spatial query operations')
    .addTag('Validation', 'Topological network integrity rules and report')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend server successfully started on port ${port}`);
  console.log(`API Base URL: http://localhost:${port}/api`);
  console.log(`Swagger Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
