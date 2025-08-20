import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // 增加事务超时时间，解决PDF上传时的事务超时问题
      transactionOptions: {
        timeout: 120000, // 2分钟超时，支持大PDF文件
      },
    });
  }

  async onModuleInit() {
    const dbUrl = process.env.DATABASE_URL;
    const cwd = process.cwd();
    let absoluteDbPath = 'N/A';
    if (dbUrl && dbUrl.startsWith('file:')) {
      const relativePath = dbUrl.substring(5);
      absoluteDbPath = path.resolve(cwd, relativePath);
    }

    this.logger.log(`Current Working Directory (CWD): ${cwd}`);
    this.logger.log(`Attempting to connect using DATABASE_URL: ${dbUrl}`);
    this.logger.log(`Resolved absolute database path: ${absoluteDbPath}`);

    try {
      await this.$connect();
      this.logger.log('Prisma Service connected to the database successfully.');
    } catch (error) {
      this.logger.error(
        `Prisma Service failed to connect. Check CWD, DATABASE_URL, path, and permissions. Error:`,
        error,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma Service disconnected from the database.');
  }
}
