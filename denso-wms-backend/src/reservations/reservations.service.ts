import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { OutboundReservation } from './entities/outbound-reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';

export interface StockSummary {
  partId: string;
  productCode: string;
  partName: string;
  physicalStock: number;
  activeReserved: number;
  availableToPromise: number;
}

@Injectable()
export class ReservationsService {
  constructor(
    @InjectEntityManager()
    private readonly em: EntityManager,
  ) {}

  /** Get stock summary with available-to-promise */
  async getStockSummary(partId: string): Promise<StockSummary> {
    // Get physical stock
    const part = await this.em.query(
      `SELECT id, product_code, part_name, quantity_pcs FROM parts WHERE id = $1`,
      [partId],
    );
    if (!part || part.length === 0) {
      throw new NotFoundException(`Part ${partId} not found`);
    }

    const physicalStock = Number(part[0].quantity_pcs) || 0;

    // Get active reserved quantity
    const reserved = await this.em.query(
      `SELECT COALESCE(SUM(quantity_pcs), 0) AS total
       FROM outbound_reservations
       WHERE part_id = $1 AND status = 'RESERVED'
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [partId],
    );
    const activeReserved = Number(reserved[0].total) || 0;

    return {
      partId,
      productCode: part[0].product_code,
      partName: part[0].part_name,
      physicalStock,
      activeReserved,
      availableToPromise: physicalStock - activeReserved,
    };
  }

  /** List all parts with stock summaries */
  async listAllSummaries(): Promise<StockSummary[]> {
    const parts = await this.em.query(
      `SELECT id, product_code, part_name, quantity_pcs FROM parts WHERE quantity_pcs > 0 ORDER BY part_name`,
    );

    if (!parts.length) return [];

    const partIds = parts.map((p: any) => p.id);
    const reservedRows = await this.em.query(
      `SELECT part_id, COALESCE(SUM(quantity_pcs), 0) AS total
       FROM outbound_reservations
       WHERE part_id = ANY($1) AND status = 'RESERVED'
         AND (expires_at IS NULL OR expires_at > NOW())
       GROUP BY part_id`,
      [partIds],
    );

    const reservedMap: Record<string, number> = {};
    for (const row of reservedRows) {
      reservedMap[row.part_id] = Number(row.total);
    }

    return parts.map((p: any) => ({
      partId: p.id,
      productCode: p.product_code,
      partName: p.part_name,
      physicalStock: Number(p.quantity_pcs),
      activeReserved: reservedMap[p.id] || 0,
      availableToPromise: Number(p.quantity_pcs) - (reservedMap[p.id] || 0),
    }));
  }

  /** Create a new soft reservation with SELECT FOR UPDATE lock */
  async createReservation(
    dto: CreateReservationDto,
    reservedBy: string,
  ): Promise<OutboundReservation> {
    return this.em.transaction(async (txEm) => {
      // Handle idempotency
      if (dto.idempotencyKey) {
        const existing = await txEm.query(
          `SELECT * FROM outbound_reservations WHERE idempotency_key = $1`,
          [dto.idempotencyKey],
        );
        if (existing.length > 0) {
          // Return existing record (idempotent)
          return existing[0] as OutboundReservation;
        }
      }

      // Lock the part row to prevent race conditions
      const part = await txEm.query(
        `SELECT id, quantity_pcs FROM parts WHERE id = $1 FOR UPDATE`,
        [dto.partId],
      );
      if (!part || part.length === 0) {
        throw new NotFoundException(`Part ${dto.partId} not found`);
      }

      const physicalStock = Number(part[0].quantity_pcs) || 0;

      // Get current active reservations (also lock them)
      const reserved = await txEm.query(
        `SELECT COALESCE(SUM(quantity_pcs), 0) AS total
         FROM outbound_reservations
         WHERE part_id = $1 AND status = 'RESERVED'
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [dto.partId],
      );
      const activeReserved = Number(reserved[0].total) || 0;
      const atp = physicalStock - activeReserved;

      if (dto.quantityPcs > atp) {
        throw new BadRequestException(
          `Không đủ tồn khả dụng. Yêu cầu: ${dto.quantityPcs}, ATP: ${atp} (tồn thực: ${physicalStock}, đã giữ: ${activeReserved})`,
        );
      }

      // Insert reservation
      const result = await txEm.query(
        `INSERT INTO outbound_reservations
           (order_reference, part_id, lot_id, quantity_pcs, status, idempotency_key, reserved_by, notes, expires_at)
         VALUES ($1, $2, $3, $4, 'RESERVED', $5, $6, $7, $8)
         RETURNING *`,
        [
          dto.orderReference,
          dto.partId,
          dto.lotId ?? null,
          dto.quantityPcs,
          dto.idempotencyKey ?? null,
          reservedBy,
          dto.notes ?? null,
          dto.expiresAt ? new Date(dto.expiresAt) : null,
        ],
      );

      return result[0] as OutboundReservation;
    });
  }

  /** Cancel a reservation */
  async cancelReservation(
    id: string,
    cancelledBy: string,
    role: string,
  ): Promise<OutboundReservation> {
    const reservation = await this.em.query(
      `SELECT * FROM outbound_reservations WHERE id = $1`,
      [id],
    );
    if (!reservation.length) {
      throw new NotFoundException(`Reservation ${id} not found`);
    }

    const res = reservation[0];
    if (res.status !== 'RESERVED') {
      throw new BadRequestException(`Chỉ có thể hủy phiếu giữ ở trạng thái RESERVED. Hiện tại: ${res.status}`);
    }

    // SoD: staff can only cancel their own reservations
    if (role === 'warehouse_staff' && res.reserved_by !== cancelledBy) {
      throw new ForbiddenException('Bạn không có quyền hủy phiếu giữ của người khác');
    }

    const updated = await this.em.query(
      `UPDATE outbound_reservations SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return updated[0] as OutboundReservation;
  }

  /** Confirm picking – moves reservation to PICKED */
  async confirmPicking(
    id: string,
    pickedBy: string,
  ): Promise<OutboundReservation> {
    return this.em.transaction(async (txEm) => {
      const reservation = await txEm.query(
        `SELECT * FROM outbound_reservations WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!reservation.length) {
        throw new NotFoundException(`Reservation ${id} not found`);
      }

      const res = reservation[0];
      if (res.status !== 'RESERVED') {
        throw new BadRequestException(`Chỉ có thể xác nhận lấy hàng khi trạng thái là RESERVED. Hiện tại: ${res.status}`);
      }

      // Check part still has enough stock
      const part = await txEm.query(
        `SELECT quantity_pcs FROM parts WHERE id = $1 FOR UPDATE`,
        [res.part_id],
      );
      if (!part.length || Number(part[0].quantity_pcs) < Number(res.quantity_pcs)) {
        throw new BadRequestException('Tồn kho không đủ để xác nhận lấy hàng');
      }

      // Deduct from physical stock
      await txEm.query(
        `UPDATE parts SET quantity_pcs = quantity_pcs - $1, updated_at = NOW() WHERE id = $2`,
        [res.quantity_pcs, res.part_id],
      );

      // Update reservation
      const updated = await txEm.query(
        `UPDATE outbound_reservations SET status = 'PICKED', updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id],
      );
      return updated[0] as OutboundReservation;
    });
  }

  /** List reservations (optionally filter by part or status) */
  async listReservations(filters?: {
    partId?: string;
    status?: string;
    reservedBy?: string;
  }): Promise<any[]> {
    let query = `
      SELECT r.*, p.product_code, p.part_name
      FROM outbound_reservations r
      LEFT JOIN parts p ON p.id = r.part_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filters?.partId) {
      query += ` AND r.part_id = $${idx++}`;
      params.push(filters.partId);
    }
    if (filters?.status) {
      query += ` AND r.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters?.reservedBy) {
      query += ` AND r.reserved_by = $${idx++}`;
      params.push(filters.reservedBy);
    }

    query += ` ORDER BY r.created_at DESC LIMIT 200`;

    return this.em.query(query, params);
  }

  /** Expire overdue reservations (call periodically) */
  async expireOverdue(): Promise<number> {
    const result = await this.em.query(
      `UPDATE outbound_reservations SET status = 'EXPIRED', updated_at = NOW()
       WHERE status = 'RESERVED' AND expires_at IS NOT NULL AND expires_at <= NOW()
       RETURNING id`,
    );
    return result.length;
  }
}
