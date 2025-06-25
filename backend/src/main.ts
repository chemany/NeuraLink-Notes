import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express'; // 导入 express
import * as path from 'path';
import { MulterError } from 'multer';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // logger: console, // 启用详细日志 (可选)
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const logger = new Logger('CORS');

  // 启用全局 DTO 验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 启用 CORS
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'];

  // --- Add detailed logging for CORS ---
  logger.log(`CORS allowedOrigins: [${allowedOrigins.join(', ')}]`);

  app.enableCors({
    origin: (origin, callback) => {
      // 允许来自 Postman 或其他无源头的请求（用于测试）
      if (!origin) {
        logger.log(`CORS: Allowing request with no origin (e.g., Postman)`);
        return callback(null, true);
      }
      if (allowedOrigins.indexOf(origin) !== -1) {
        logger.log(`CORS: Allowing origin: ${origin}`);
        return callback(null, true);
      } else {
        logger.error(`CORS: Blocking origin: ${origin}. It is not in the allowed list.`);
        return callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // 增加请求体大小限制
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // 设置全局 API 前缀
  app.setGlobalPrefix('api');

  // 静态托管 uploads 目录，供前端访问图片（使用绝对路径，兼容源码和dist运行），并添加CORS头
  app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(path.resolve(process.cwd(), 'uploads')));

  // 全局异常处理中间件，捕获Multer和其他错误，返回JSON
  app.use((err, req, res, next) => {
    if (err instanceof MulterError) {
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(500).json({ error: err.message || '服务器内部错误' });
    }
    next();
  });

  // 修改默认端口为 3001
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
