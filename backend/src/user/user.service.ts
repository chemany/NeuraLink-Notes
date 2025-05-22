import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('邮箱已被注册');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    try {
      const user = await this.prisma.user.create({
        data: {
          ...data,
          password: hashedPassword,
        },
      });
      // 创建关联的 UserSettings
      await this.prisma.userSettings.create({
        data: {
          userId: user.id,
          // 您可以在这里设置 UserSettings 的默认值
          // llmModel: 'default_from_service',
        }
      });
      // 从返回的用户对象中移除密码字段
      const { password, ...result } = user;
      return result as User; // 断言为 User 类型 (不包含 password)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // 处理 Prisma 特有的错误，例如唯一约束冲突 (虽然上面已经检查过email)
        if (error.code === 'P2002') {
          throw new ConflictException('用户创建失败，邮箱可能已被占用。');
        }
      }
      throw new InternalServerErrorException('创建用户时发生未知错误。');
    }
  }

  // 您可能还需要其他用户管理方法，例如 updateUser, deleteUser 等
}
