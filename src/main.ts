import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new BigIntInterceptor());

  app.setGlobalPrefix('api');
  app.enableCors();

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`stackMesh API running on port ${port} with prefix /api`);
}

bootstrap();
