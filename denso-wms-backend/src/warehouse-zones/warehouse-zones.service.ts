import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Container } from '../containers/entities/container.entity';
import { rackFamilyStorageMode } from '../inventory/rack-product-family.rules';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { WarehouseZone } from './entities/warehouse-zone.entity';

@Injectable()
export class WarehouseZonesService {
  constructor(
    @InjectRepository(WarehouseZone) private readonly zones: Repository<WarehouseZone>,
    @InjectRepository(Container) private readonly racks: Repository<Container>,
  ) {}

  list(warehouseCode?: string) {
    return this.zones.find({ where: warehouseCode ? { warehouseCode } : {}, order: { code: 'ASC' } });
  }

  async create(dto: CreateZoneDto) {
    const code = dto.code.trim().toUpperCase();
    const warehouseCode = dto.warehouseCode.trim().toUpperCase();
    const exists = await this.zones.findOne({ where: { code, warehouseCode } });
    if (exists) throw new BadRequestException({ code: 'ZONE_EXISTS', message: `${code} đã tồn tại` });
    this.assertFamilyMode(dto.productFamily, dto.storageMode || 'ambient');
    return this.zones.save(this.zones.create({ ...dto, code, warehouseCode, description: dto.description || null, storageMode: dto.storageMode || 'ambient', active: dto.active ?? true }));
  }

  async update(id: string, dto: UpdateZoneDto) {
    return this.zones.manager.transaction(async manager => {
      await manager.query('SELECT id FROM warehouse_zones WHERE id = $1 FOR UPDATE', [id]);
      const zone = await manager.findOneBy(WarehouseZone, { id });
      if (!zone) throw new NotFoundException({ code: 'ZONE_NOT_FOUND', message: 'Không tìm thấy Zone' });
      const oldCode = zone.code;
      const oldWarehouse = zone.warehouseCode;
      const code = dto.code?.trim().toUpperCase() || oldCode;
      const warehouseCode = dto.warehouseCode?.trim().toUpperCase() || oldWarehouse;
      const storageMode = dto.storageMode || zone.storageMode;
      const productFamily = dto.productFamily === undefined ? zone.productFamily : dto.productFamily;
      this.assertFamilyMode(productFamily, storageMode);
      if (code !== oldCode || warehouseCode !== oldWarehouse || storageMode !== zone.storageMode || productFamily !== zone.productFamily) {
        for (const key of [...new Set([`${oldWarehouse}/${oldCode}`, `${warehouseCode}/${code}`])].sort()) {
          await manager.query("SELECT pg_advisory_xact_lock(hashtext('MASAN_WMS_PHYSICAL_RACKS'), hashtext($1))", [key]);
        }
        await manager.query('SELECT id FROM containers WHERE warehouse_code = $1 AND zone_code = $2 ORDER BY id FOR UPDATE', [oldWarehouse, oldCode]);
        const racks = await manager.find(Container, { where: { warehouseCode: oldWarehouse, zoneCode: oldCode }, relations: { parts: true } });
        const stock = racks.flatMap(rack => rack.parts.filter(part => part.quantityPcs > 0 || part.cartonCount > 0 || Number(part.totalWeightKg) > 0));
        if (storageMode !== zone.storageMode && stock.length) {
          throw new BadRequestException({ code: 'ZONE_MODE_HAS_STOCK', message: 'Không thể đổi điều kiện bảo quản khi Zone còn hàng' });
        }
        if (productFamily && (stock.some(part => part.productFamily !== productFamily)
          || racks.some(rack => rack.productFamily && rack.productFamily !== productFamily))) {
          throw new BadRequestException({ code: 'ZONE_PRODUCT_FAMILY_MISMATCH', message: 'Zone còn kệ hoặc hàng không thuộc nhóm được chọn' });
        }
        if (code !== oldCode || warehouseCode !== oldWarehouse) {
          if (await manager.existsBy(WarehouseZone, { code, warehouseCode })
            || await manager.existsBy(Container, { zoneCode: code, warehouseCode })) {
            throw new BadRequestException({ code: 'ZONE_EXISTS', message: 'Mã Zone đích đã được sử dụng' });
          }
          await manager.update(Container, { warehouseCode: oldWarehouse, zoneCode: oldCode }, { warehouseCode, zoneCode: code });
        }
      }
      return manager.save(Object.assign(zone, dto, { code, warehouseCode, storageMode, productFamily }));
    });
  }

  private assertFamilyMode(family: string | null | undefined, mode: string): void {
    if (family && rackFamilyStorageMode(family) !== mode) {
      throw new BadRequestException({ code: 'ZONE_FAMILY_MODE_MISMATCH', message: 'Nhóm hàng không phù hợp điều kiện bảo quản của Zone' });
    }
  }

  async remove(id: string) {
    const zone = await this.zones.findOne({ where: { id } });
    if (!zone) return;
    const rackCount = await this.racks.count({ where: { warehouseCode: zone.warehouseCode, zoneCode: zone.code } });
    if (rackCount > 0) throw new BadRequestException({ code: 'ZONE_HAS_RACKS', message: `Zone còn ${rackCount} kệ. Hãy chuyển kệ sang Zone khác trước.` });
    await this.zones.remove(zone);
  }
}
