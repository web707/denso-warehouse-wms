import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

@Controller('supply-chain')
export class SupplyChainController {
  constructor(private readonly db:DataSource) {}

  @Get('dispatch/:id')
  async dispatch(@Param('id',ParseUUIDPipe) id:string) {
    const [order] = await this.db.query('SELECT id,reference,sku,quantity,status,created_at FROM dispatch_orders WHERE id=$1',[id]);
    if (!order) throw new NotFoundException('Không tìm thấy đơn xuất');
    const allocations=await this.db.query(`
      SELECT a.part_id,a.lot_id,a.quantity,l.lot_number,p.quality_scope_id,p.container_id,p.preferred_rack_slot,c.name rack
      FROM dispatch_allocations a JOIN inventory_lots l ON l.id=a.lot_id
      JOIN parts p ON p.id=a.part_id LEFT JOIN containers c ON c.id=p.container_id
      WHERE a.dispatch_id=$1 ORDER BY a.part_id
    `,[id]);
    const events=await this.db.query(`
      SELECT 'dispatch' AS source,e.status AS event,e.created_at AS at,u.email AS actor,NULL::text AS detail
      FROM dispatch_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.dispatch_id=$1
      UNION ALL
      SELECT 'packing','PACKING',p.created_at,u.email,p.quantity::text
      FROM dispatch_packing_entries p LEFT JOIN users u ON u.id=p.actor_id WHERE p.dispatch_id=$1
      ORDER BY at,source
    `,[id]);
    const documents=await this.db.query('SELECT id,kind,status FROM warehouse_documents WHERE reference_id=$1',[id]);
    return {order,allocations,events,documents};
  }

  @Get('receipt/:id')
  async receipt(@Param('id',ParseUUIDPipe) id:string) {
    const [receipt]=await this.db.query('SELECT * FROM receiving_receipts WHERE id=$1',[id]);
    if(!receipt) throw new NotFoundException('Không tìm thấy phiếu nhận');
    const parts=await this.db.query(`
      SELECT p.id,p.lot_id,p.lot_number,p.product_code,p.quantity_pcs,p.quality_scope_id,p.container_id,
        p.preferred_rack_slot,c.name rack FROM parts p LEFT JOIN containers c ON c.id=p.container_id
      WHERE p.id=ANY($1::uuid[]) ORDER BY p.id
    `,[[receipt.part_id,receipt.damaged_part_id].filter(Boolean)]);
    const inspections=await this.db.query(`
      SELECT id,inspection_id,judgment,inspection_date,inspector_id,quality_scope_id
      FROM inspections WHERE quality_scope_id=ANY($1::uuid[]) ORDER BY inspection_date,id
    `,[parts.flatMap((p:{quality_scope_id?:string})=>p.quality_scope_id?[p.quality_scope_id]:[])]);
    const ledger=await this.db.query(`
      SELECT id,type,quantity_pcs,created_at,from_rack_id,to_rack_id,lot_id,part_id,destination_part_id
      FROM inventory_transactions WHERE part_id=ANY($1::uuid[]) OR destination_part_id=ANY($1::uuid[])
      ORDER BY created_at,id
    `,[parts.map((p:{id:string})=>p.id)]);
    const documents=await this.db.query('SELECT id,kind,status FROM warehouse_documents WHERE reference_id=$1',[id]);
    return {receipt,parts,inspections,ledger,documents};
  }
}
