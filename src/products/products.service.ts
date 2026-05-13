import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductDto } from './dto/list-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  async list(query: ListProductDto) {
    const { page, pageSize, search } = query;
    const where = search
      ? [
          { name: Like(`%${search}%`) },
          { code: Like(`%${search}%`) },
        ]
      : undefined;
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { code: 'ASC', name: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async findOne(id: string): Promise<Product> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Product not found');
    return item;
  }

  create(dto: CreateProductDto): Promise<Product> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Product not found');
  }
}
