import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { Role } from '../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUserDto } from './dto/list-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ---- used by AuthModule (internal) ----

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

  async setRefreshToken(userId: string, token: string | null): Promise<void> {
    const hash = token ? await bcrypt.hash(token, 10) : null;
    await this.userRepo.update(userId, { refreshTokenHash: hash });
  }

  // ---- admin management ----

  async list(query: ListUserDto) {
    const { page, pageSize, search, role } = query;
    const qb = this.userRepo
      .createQueryBuilder('u')
      .orderBy('u.role', 'ASC')
      .addOrderBy('u.username', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('u.username LIKE :s', { s: `%${search}%` }).orWhere(
            'u.fullName LIKE :s',
            { s: `%${search}%` },
          );
        }),
      );
    }
    if (role) qb.andWhere('u.role = :r', { r: role });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async create(input: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOne({
      where: { username: input.username },
    });
    if (existing) {
      throw new ConflictException(`username "${input.username}" ถูกใช้แล้ว`);
    }
    const password = await bcrypt.hash(input.password, 10);
    const user = this.userRepo.create({
      username: input.username,
      fullName: input.fullName,
      role: input.role,
      isActive: input.isActive ?? true,
      password,
    });
    return this.userRepo.save(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
  ): Promise<User> {
    const user = await this.findById(id);

    // guard: ห้ามถอด role ตัวเองจาก admin
    if (id === actorId && dto.role && dto.role !== Role.ADMIN) {
      throw new ForbiddenException('ไม่อนุญาตให้เปลี่ยน role ของตัวเอง');
    }
    // guard: ห้าม disable ตัวเอง
    if (id === actorId && dto.isActive === false) {
      throw new ForbiddenException('ไม่อนุญาตให้ปิดใช้งานบัญชีของตัวเอง');
    }
    // guard: ต้องเหลือ admin active อย่างน้อย 1 คน
    if (user.role === Role.ADMIN && dto.role === Role.STAFF) {
      const adminCount = await this.userRepo.count({
        where: { role: Role.ADMIN, isActive: true },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('ต้องมี admin อย่างน้อย 1 คน');
      }
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
      // เปลี่ยน password → revoke refresh token เก่า (logout ทุกอุปกรณ์)
      user.refreshTokenHash = null;
    }
    return this.userRepo.save(user);
  }

  async remove(id: string, actorId: string): Promise<void> {
    if (id === actorId) {
      throw new ForbiddenException('ไม่อนุญาตให้ลบบัญชีของตัวเอง');
    }
    const user = await this.findById(id);
    if (user.role === Role.ADMIN) {
      const adminCount = await this.userRepo.count({
        where: { role: Role.ADMIN, isActive: true },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('ต้องมี admin อย่างน้อย 1 คน');
      }
    }
    await this.userRepo.delete(id);
  }
}
