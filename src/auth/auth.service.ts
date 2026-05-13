import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const matched = await bcrypt.compare(password, user.password);
    if (!matched) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.signTokens(user.id, user.username, user.role);
    await this.usersService.setRefreshToken(user.id, tokens.refreshToken);
    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.usersService.findByIdWithRefreshHash(userId);
    if (!user || !user.refreshTokenHash) {
      throw new ForbiddenException('Access denied');
    }
    const matched = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matched) throw new ForbiddenException('Access denied');

    const tokens = await this.signTokens(user.id, user.username, user.role);
    await this.usersService.setRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.usersService.setRefreshToken(userId, null);
  }

  private async signTokens(userId: string, username: string, role: Role) {
    const payload: JwtPayload = { sub: userId, username, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as SignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as SignOptions['expiresIn'],
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
