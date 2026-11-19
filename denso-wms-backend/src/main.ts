import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  if (process.env.WMS_DEMO_MODE === 'true'
    && (process.env.DB_NAME !== 'wms_dashboard_demo_test' || process.env.NODE_ENV === 'production')) {
    throw new Error('Demo mode requires its isolated QA database and a non-production process.');
  }
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const trustProxy = config.get<string>('trustProxy');
  if (trustProxy && trustProxy !== 'false') {
    const expressApp = app.getHttpAdapter().getInstance();
    if (trustProxy === 'true') {
      expressApp.set('trust proxy', true);
    } else {
      const parsedNum = Number(trustProxy);
      expressApp.set('trust proxy', isNaN(parsedNum) ? trustProxy : parsedNum);
    }
  }

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  const allowedOrigins = config.get<any>('corsOrigin');
  app.enableCors({
    origin: allowedOrigins && allowedOrigins.length > 0 && allowedOrigins[0] !== '*' ? allowedOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'Idempotency-Key'],
  });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MASAN Consumer WMS API')
    .setDescription('Warehouse rack allocation and 3D storage management API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : (config.get<number>('port') ?? 5001);
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`MASAN WMS listening on http://${host}:${port}/api (docs at /api/docs)`);
}

bootstrap();
