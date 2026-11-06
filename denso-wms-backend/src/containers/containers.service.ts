import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ContainerType } from '../container-types/entities/container-type.entity';
import { HistoryEventType } from '../history/entities/history-event.entity';
import { HistoryService } from '../history/history.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { Container } from './entities/container.entity';
import { Part } from '../parts/entities/part.entity';
import { assertRackProductFamily, rackFamilyStorageMode, RACK_PRODUCT_FAMILIES } from '../inventory/rack-product-family.rules';
import { WarehouseZone } from '../warehouse-zones/entities/warehouse-zone.entity';
import { assertStoragePlacement } from '../inventory/storage-placement.rules';

@Injectable()
export class ContainersService {
  constructor(
    @InjectRepository(Container) private readonly containers: Repository<Container>,
    @InjectRepository(ContainerType) private readonly containerTypes: Repository<ContainerType>,
    private readonly history: HistoryService,
  ) {}

  findAll(orderId?: string): Promise<Container[]> {
    return this.containers.find({
      where: orderId ? { orderId } : {},
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Container> {
    const container = await this.containers.findOne({ where: { id } });
    if (!container) {
      throw new NotFoundException({
        code: 'CONTAINER_NOT_FOUND',
        message: 'Không tìm thấy kệ kho',
      });
    }
    return container;
  }

  /**
   * Protect the physical warehouse/zone, NOT an order. The old order-scoped
   * initializer could create R01–R20 repeatedly for different orders.
   * Lock on a stable zone key so simultaneous requests cannot over-allocate.
   */
  private async lockZone(em: EntityManager, warehouseCode: string, zoneCode: string) {
    await em.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
      'MASAN_WMS_PHYSICAL_RACKS', `${warehouseCode}/${zoneCode}`,
    ]);
  }

  private validatePhysicalRackName(name: string): string {
    const normalized = String(name || '').trim().toUpperCase();
    if (!/^R(0[1-9]|1[0-9]|20)$/.test(normalized)) {
      throw new BadRequestException({
        code: 'INVALID_PHYSICAL_RACK_NAME',
        message: 'Mỗi Zone có đúng 20 vị trí kệ vật lý, từ R01 đến R20.',
      });
    }
    return normalized;
  }

  async create(dto: CreateContainerDto): Promise<Container> {
    if (dto.productFamily && !RACK_PRODUCT_FAMILIES.includes(dto.productFamily as typeof RACK_PRODUCT_FAMILIES[number])) throw new BadRequestException({ code:'RACK_INVALID_FAMILY', message:'Chủ đề kệ không hợp lệ' });
    const name = this.validatePhysicalRackName(dto.name);
    const warehouseCode = (dto.warehouseCode || 'DENSO-WH').trim().toUpperCase();
    const zoneCode = (dto.zoneCode || 'ZONE-A').trim().toUpperCase();
    const type = await this.containerTypes.findOne({ where: { id: dto.containerTypeId } });
    if (!type) throw new NotFoundException({ code: 'CONTAINER_TYPE_NOT_FOUND', message: 'Không tìm thấy loại kệ' });

    const container = await this.containers.manager.transaction(async (em) => {
      await this.lockZone(em, warehouseCode, zoneCode);
      const existing = await em.find(Container, { where: { warehouseCode, zoneCode } });
      if (existing.length >= 20) throw new BadRequestException({
        code: 'ZONE_RACK_LIMIT',
        message: `${zoneCode} đã có ${existing.length} bản ghi kệ. Chỉ cho phép tối đa 20 kệ vật lý, hãy đối chiếu bản ghi dư/trùng trước khi tạo mới.`,
      });
      if (existing.some((rack) => rack.name.trim().toUpperCase() === name)) {
        throw new BadRequestException({ code: 'ZONE_RACK_DUPLICATE', message: `Kệ ${name} đã tồn tại trong ${zoneCode}.` });
      }
      if (dto.productFamily) {
        const zone = await em.findOne(WarehouseZone, { where:{ warehouseCode, code:zoneCode } });
        if (rackFamilyStorageMode(dto.productFamily) !== (zone?.storageMode || 'ambient')) throw new BadRequestException({ code:'RACK_FAMILY_ZONE_MISMATCH', message:'Chủ đề kệ không phù hợp với điều kiện bảo quản của Zone.' });
      }
      return em.save(Container, em.create(Container, {
        containerTypeId: dto.containerTypeId,
        orderId: dto.orderId,
        name,
        warehouseCode,
        zoneCode,
        productFamily: dto.productFamily || null,
        maxCbmOverride: dto.maxCbmOverride?.toString() ?? null,
        maxPayloadKgOverride: dto.maxPayloadKgOverride?.toString() ?? null,
      }));
    });
    await this.history.log(HistoryEventType.CONTAINER_CREATED, `Tạo kệ ${container.name}`, {
      rackId: container.id, rackName: container.name,
    }, container.orderId);
    return this.findOne(container.id);
  }

  async update(id: string, dto: UpdateContainerDto): Promise<Container> {
    const current = await this.findOne(id);
    const targetWarehouse = (dto.warehouseCode ?? current.warehouseCode).trim().toUpperCase();
    const targetZone = (dto.zoneCode ?? current.zoneCode).trim().toUpperCase();
    const targetName = dto.name === undefined ? current.name : this.validatePhysicalRackName(dto.name);
    const moving = current.warehouseCode !== targetWarehouse || current.zoneCode !== targetZone;
    const renaming = current.name.trim().toUpperCase() !== targetName.trim().toUpperCase();
    await this.containers.manager.transaction(async (em) => {
      // Lock zones in a stable order to avoid deadlocks during zone moves.
      const keys = [...new Set([
        `${current.warehouseCode}/${current.zoneCode}`, `${targetWarehouse}/${targetZone}`,
      ])].sort();
      for (const key of keys) {
        const divider = key.indexOf('/');
        await this.lockZone(em, key.slice(0, divider), key.slice(divider + 1));
      }
      const container = await em.findOne(Container, { where: { id } });
      if (!container) throw new NotFoundException({ code: 'CONTAINER_NOT_FOUND', message: 'Không tìm thấy kệ kho' });
      if (moving || renaming) {
        const records = await em.find(Container, { where: { warehouseCode: targetWarehouse, zoneCode: targetZone } });
        if (moving && records.length >= 20) throw new BadRequestException({
          code: 'ZONE_RACK_LIMIT', message: `${targetZone} đã có 20 kệ, không thể chuyển thêm kệ sang.`,
        });
        if (records.some((rack) => rack.id !== id && rack.name.trim().toUpperCase() === targetName.trim().toUpperCase())) {
          throw new BadRequestException({ code: 'ZONE_RACK_DUPLICATE', message: `Kệ ${targetName} đã tồn tại trong ${targetZone}.` });
        }
      }
      if (dto.productFamily && !RACK_PRODUCT_FAMILIES.includes(dto.productFamily as typeof RACK_PRODUCT_FAMILIES[number])) throw new BadRequestException({ code:'RACK_INVALID_FAMILY', message:'Chủ đề kệ không hợp lệ' });
      if (moving || dto.productFamily !== undefined) {
        const targetFamily = dto.productFamily === undefined ? container.productFamily : dto.productFamily;
        const targetZoneEntity = await em.findOne(WarehouseZone, { where: {warehouseCode: targetWarehouse, code: targetZone} });
        if (rackFamilyStorageMode(targetFamily) && rackFamilyStorageMode(targetFamily) !== (targetZoneEntity?.storageMode || 'ambient')) {
          throw new BadRequestException({ code:'RACK_FAMILY_ZONE_MISMATCH', message:'Chủ đề kệ không phù hợp Zone đích.' });
        }
        const stocked = await em.find(Part, { where: {containerId: id} });
        for (const p of stocked) {
          assertStoragePlacement({productClass:p.storageClass, zoneMode:targetZoneEntity?.storageMode, rackClasses:stocked.filter(other=>other.id!==p.id).map(other=>other.storageClass), productName:p.partName, rackName:container.name});
        }
      }
      if (dto.productFamily !== undefined) {
        // A rack already containing products cannot be relabeled to a different family.
        const occupants = await em.find(Part, { where: { containerId: id } });
        for (const p of occupants) {
          assertRackProductFamily({ rackFamily: dto.productFamily, peers: occupants.filter((other) => other.id !== p.id), productName: p.partName, productClass: p.storageClass, rackName: container.name });
        }
        container.productFamily = dto.productFamily || null;
      }
      if (dto.containerTypeId) container.containerTypeId = dto.containerTypeId;
      if (dto.orderId !== undefined) container.orderId = dto.orderId;
      container.name = targetName;
      container.warehouseCode = targetWarehouse;
      container.zoneCode = targetZone;
      if (dto.maxCbmOverride !== undefined) container.maxCbmOverride = dto.maxCbmOverride.toString();
      if (dto.maxPayloadKgOverride !== undefined) container.maxPayloadKgOverride = dto.maxPayloadKgOverride.toString();
      await em.save(container);
    });
    const updated = await this.findOne(id);
    await this.history.log(HistoryEventType.CONTAINER_UPDATED, `Cập nhật kệ ${updated.name}`, {
      rackId: updated.id, rackName: updated.name,
    }, updated.orderId);
    return updated;
  }

  async initializeWarehouse(params: {
    orderId: string;
    warehouseCode?: string;
    zoneCode?: string;
    rackCount?: number;
    rackTypeId?: string;
  }): Promise<{ racks: Container[]; createdCount: number; renamedCount: number; extraCount: number; totalRecords: number }> {
    if (!params.orderId) throw new BadRequestException({
      code: 'WAREHOUSE_ORDER_REQUIRED', message: 'Cần chỉ định lô gốc trước khi tạo kệ.',
    });
    const warehouseCode = (params.warehouseCode || 'DENSO-WH').trim().toUpperCase();
    const zoneCode = (params.zoneCode || 'ZONE-A').trim().toUpperCase();
    const rackCount = Math.max(1, Math.min(20, Math.trunc(params.rackCount || 20)));

    const result = await this.containers.manager.transaction(async (em) => {
      await this.lockZone(em, warehouseCode, zoneCode);
      let existing = await em.find(Container, {
        where: { warehouseCode, zoneCode }, order: { createdAt: 'ASC' },
      });
      const normalizedNames = existing.map((row) => row.name.trim().toUpperCase());
      const duplicateCount = existing.length - new Set(normalizedNames).size;
      // Do not delete, rename, or reassign historic racks with linked inventory.
      if (existing.length > rackCount || duplicateCount > 0) {
        return {
          racks: existing.slice(0, rackCount),
          createdCount: 0, renamedCount: 0,
          extraCount: Math.max(existing.length - rackCount, duplicateCount),
          totalRecords: existing.length,
        };
      }
      if (existing.length === rackCount) return {
        racks: existing, createdCount: 0, renamedCount: 0,
        extraCount: 0, totalRecords: existing.length,
      };

      let type: ContainerType | null = null;
      if (params.rackTypeId) type = await em.findOne(ContainerType, { where: { id: params.rackTypeId } });
      if (!type && existing[0]?.containerTypeId) {
        type = await em.findOne(ContainerType, { where: { id: existing[0].containerTypeId } });
      }
      if (!type) type = await em.findOne(ContainerType, { where: { code: 'RACK20-A' } });
      if (!type) type = (await em.find(ContainerType, { order: { createdAt: 'ASC' }, take: 1 }))[0] || null;
      if (!type) throw new NotFoundException({ code: 'RACK_TYPE_NOT_FOUND', message: 'Không tìm thấy cấu hình kệ 20 ô.' });

      const usedNames = new Set(normalizedNames);
      const missingNames = Array.from({ length: rackCount }, (_, index) => `R${String(index + 1).padStart(2, '0')}`)
        .filter((name) => !usedNames.has(name))
        .slice(0, rackCount - existing.length);
      if (missingNames.length) {
        const rows = missingNames.map((name) => em.create(Container, {
          containerTypeId: type!.id, orderId: params.orderId, name,
          warehouseCode, zoneCode, maxCbmOverride: null, maxPayloadKgOverride: null,
        }));
        await em.save(Container, rows);
      }
      existing = await em.find(Container, {
        where: { warehouseCode, zoneCode }, order: { createdAt: 'ASC' },
      });
      return {
        racks: existing.slice(0, rackCount), createdCount: missingNames.length,
        renamedCount: 0, extraCount: 0, totalRecords: existing.length,
      };
    });

    if (result.createdCount > 0) {
      await this.history.log(HistoryEventType.CONTAINER_CREATED,
        `Bổ sung ${result.createdCount} kệ vào ${warehouseCode}/${zoneCode}`,
        { warehouseCode, zoneCode, createdCount: result.createdCount, rackIds: result.racks.map((r) => r.id) },
        params.orderId);
    }
    return result;
  }

  async remove(id: string): Promise<void> {
    const container = await this.findOne(id);
    const linkedParts = await this.containers.manager.getRepository(Part).count({ where: { containerId: id } });
    if (linkedParts > 0) {
      throw new BadRequestException({
        code: 'RACK_NOT_EMPTY',
        message: `Kệ ${container.name} đang có ${linkedParts} PART. Hãy điều chuyển hàng và kiểm tra tải trọng trước khi xóa kệ.`,
      });
    }
    await this.containers.remove(container);
    await this.history.log(
      HistoryEventType.CONTAINER_DELETED,
      `Xoá kệ ${container.name}`,
      { rackId: id, rackName: container.name },
      container.orderId,
    );
  }
}
