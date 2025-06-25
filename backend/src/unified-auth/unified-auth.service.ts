import { Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

export interface UnifiedUser {
  id: string;
  username: string;
  email: string;
}

/**
 * 统一认证服务
 * 负责与统一设置服务通信验证token，并同步用户到本地数据库
 */
@Injectable()
export class UnifiedAuthService {
  private readonly unifiedServiceUrl = 'http://localhost:3002';
  private readonly tokenCache = new Map<string, { user: UnifiedUser; expiry: number }>();
  private readonly cacheExpiryMs = 5 * 60 * 1000; // 5分钟缓存

  constructor(private prismaService: PrismaService) {
    // 定期清理过期缓存
    setInterval(() => {
      const now = Date.now();
      for (const [token, cached] of this.tokenCache.entries()) {
        if (now >= cached.expiry) {
          this.tokenCache.delete(token);
        }
      }
    }, 60 * 1000); // 每分钟清理一次
  }

  /**
   * 验证统一设置服务的token并同步用户到本地数据库
   * @param token JWT token
   * @returns 验证结果和本地用户信息
   */
  async verifyToken(token: string): Promise<{ valid: boolean; user?: UnifiedUser }> {
    try {
      console.log('[UnifiedAuthService] 验证token:', token.substring(0, 20) + '...');
      
      // 检查缓存
      const cached = this.tokenCache.get(token);
      if (cached && Date.now() < cached.expiry) {
        console.log('[UnifiedAuthService] 使用缓存的token验证结果');
        return { valid: true, user: cached.user };
      }
      
      const response = await axios.get(
        `${this.unifiedServiceUrl}/api/auth/verify`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200 && response.data.valid) {
        console.log('[UnifiedAuthService] token验证成功');
        
        // 获取用户信息并同步到本地数据库
        const userInfo = await this.getUserInfo(token);
        if (userInfo) {
          const localUser = await this.ensureLocalUser(userInfo);
          const resultUser = {
            id: localUser.id,
            username: localUser.username,
            email: localUser.email
          };
          
          // 缓存验证结果
          this.tokenCache.set(token, {
            user: resultUser,
            expiry: Date.now() + this.cacheExpiryMs
          });
          
          return {
            valid: true,
            user: resultUser
          };
        }
        
        return { valid: false };
      } else {
        console.log('[UnifiedAuthService] token验证失败:', response.data);
        return { valid: false };
      }
    } catch (error) {
      console.error('[UnifiedAuthService] token验证错误:', error.message);
      return { valid: false };
    }
  }

  /**
   * 从统一设置服务获取用户信息
   * @param token JWT token
   * @returns 用户信息
   */
  private async getUserInfo(token: string): Promise<UnifiedUser | null> {
    try {
      console.log('[UnifiedAuthService] 获取用户信息');
      
      const response = await axios.get(
        `${this.unifiedServiceUrl}/api/auth/me`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200 && response.data.user) {
        console.log('[UnifiedAuthService] 用户信息获取成功');
        return response.data.user;
      }
      
      return null;
    } catch (error) {
      console.error('[UnifiedAuthService] 获取用户信息失败:', error.message);
      return null;
    }
  }

  /**
   * 确保用户在本地数据库中存在，如果不存在则创建
   * @param userInfo 统一设置服务的用户信息
   * @returns 本地用户记录
   */
  private async ensureLocalUser(userInfo: UnifiedUser): Promise<any> {
    try {
      // 首先尝试通过邮箱查找用户
      let localUser = await this.prismaService.user.findUnique({
        where: { email: userInfo.email }
      });

      if (!localUser) {
        // 用户不存在，创建新用户
        console.log('[UnifiedAuthService] 创建本地用户:', userInfo.email);
        
        // 确保用户名唯一，如果冲突则添加后缀
        let uniqueUsername = userInfo.username;
        let counter = 1;
        while (true) {
          try {
            localUser = await this.prismaService.user.create({
              data: {
                email: userInfo.email,
                username: uniqueUsername,
                password: 'unified_auth', // 占位密码，不会使用
              }
            });
            break;
          } catch (error: any) {
            if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
              // 用户名冲突，尝试新的用户名
              uniqueUsername = `${userInfo.username}_${counter}`;
              counter++;
              console.log('[UnifiedAuthService] 用户名冲突，尝试:', uniqueUsername);
              continue;
            }
            throw error; // 其他错误直接抛出
          }
        }
        console.log('[UnifiedAuthService] 本地用户创建成功:', localUser.id);
      } else {
        // 用户存在，不需要更新用户名以避免冲突
        console.log('[UnifiedAuthService] 本地用户已存在:', localUser.id);
      }

      return localUser;
    } catch (error) {
      console.error('[UnifiedAuthService] 同步本地用户失败:', error.message);
      throw new UnauthorizedException('用户同步失败');
    }
  }
} 