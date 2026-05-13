import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findByUsername(username: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.username = :username', { username })
      .getOne();
  }

  async findByIdWithRefreshHash(id: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.refreshTokenHash')
      .where('u.id = :id', { id })
      .getOne();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(input: {
    username: string;
    fullName: string;
    password: string;
    role: Role;
  }): Promise<User> {
    const password = await bcrypt.hash(input.password, 10);
    const user = this.userRepo.create({ ...input, password });
    return this.userRepo.save(user);
  }

  async setRefreshToken(userId: string, token: string | null): Promise<void> {
    const hash = token ? await bcrypt.hash(token, 10) : null;
    await this.userRepo.update(userId, { refreshTokenHash: hash });
  }
}
