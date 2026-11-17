import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceivingReceipt } from './entities/receiving-receipt.entity';
import { ReceivingService } from './receiving.service';
import { ReceivingController } from './receiving.controller';
import { Part } from '../parts/entities/part.entity';
import { Container } from '../containers/entities/container.entity';
import { InventoryTransaction } from '../inventory/entities/inventory-transaction.entity';
import { Inspection } from '../inspections/entities/inspection.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReceivingReceipt,
      Part,
      Container,
      InventoryTransaction,
      Inspection,
    ]),
  ],
  controllers: [ReceivingController],
  providers: [ReceivingService],
  exports: [ReceivingService],
})
export class ReceivingModule {}
