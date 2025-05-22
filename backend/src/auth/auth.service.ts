import { Injectable, UnauthorizedException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { RegisterUserDto, LoginUserDto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  /**
   * 验证用户凭证
   * @param email 用户邮箱
   * @param pass 密码
   * @returns 如果验证成功，返回不含密码的用户对象，否则返回 null
   */
  async validateUser(email: string, pass: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.userService.findByEmail(email);
    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * 用户登录
   * @param user 登录用户信息 (不含密码)
   * @returns 包含 access_token 和 user 信息的对象
   */
  async login(user: Omit<User, 'password'>) {
    const payload = { email: user.email, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
      user: user,
    };
  }

  /**
   * 用户注册
   * @param registerUserDto 注册信息 DTO
   * @returns 不含密码的新用户信息
   */
  async register(registerUserDto: RegisterUserDto): Promise<Omit<User, 'password'> | null> {
    try {
      // 直接传递 DTO，UserService 中的 createUser 会处理密码哈希
      const newUser = await this.userService.createUser({
        email: registerUserDto.email,
        password: registerUserDto.password,
        username: registerUserDto.username,
      });
      return newUser; // userService.createUser 已经移除了密码
    } catch (error) {
      // 将 UserService 抛出的特定异常重新抛出，或进行处理
      if (error instanceof ConflictException || error instanceof InternalServerErrorException) {
        throw error;
      }
      // 处理其他可能的 Prisma 错误 (虽然 createUser 中已经处理了P2002)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error('Prisma Error during registration:', error.code, error.message);
        throw new InternalServerErrorException('注册过程中发生数据库错误。');
      }
      console.error('Unexpected error during registration:', error);
      throw new InternalServerErrorException('注册过程中发生未知错误。');
    }
  }
}
