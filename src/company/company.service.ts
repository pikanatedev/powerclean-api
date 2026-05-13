import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanySetting } from './company.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';

const DEFAULT_COMPANY = {
  nameTh: 'บริษัท เพาเวอร์ คลีน พลัส จำกัด สำนักงานใหญ่',
  nameEn: 'POWER CLEAN PLUS Co., LTD.',
  address: 'เลขที่ 250/65 ม.5 ต.เมืองเก่า อ.เมืองขอนแก่น จ.ขอนแก่น 40000',
  phone: '061-6956633, 062-7969847',
  taxId: '0405562003569',
  authorizerName: 'นายสันติ เหล่าสุโพธิ์',
};

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(CompanySetting)
    private readonly repo: Repository<CompanySetting>,
  ) {}

  /**
   * Singleton: returns the (only) company settings row.
   * Auto-creates with defaults if the row doesn't exist yet.
   */
  async get(): Promise<CompanySetting> {
    const existing = await this.repo.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    if (existing) return existing;
    return this.repo.save(this.repo.create(DEFAULT_COMPANY));
  }

  async update(dto: UpdateCompanyDto): Promise<CompanySetting> {
    const current = await this.get();
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) (current as any)[key] = value;
    }
    return this.repo.save(current);
  }
}
