import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { buildTypeOrmOptions } from './config/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { GlobalJwtGuard } from './auth/guards/global-jwt.guard';
import { MasanAccessGuard } from './auth/guards/masan-access.guard';
import { WmsThrottlerGuard } from './common/guards/wms-throttler.guard';
import { DivisionsModule } from './divisions/divisions.module';
import { ContainerTypesModule } from './container-types/container-types.module';
import { PackingRulesModule } from './packing-rules/packing-rules.module';
import { OrdersModule } from './orders/orders.module';
import { PartsModule } from './parts/parts.module';
import { ContainersModule } from './containers/containers.module';
import { HistoryModule } from './history/history.module';
import { ImportsModule } from './imports/imports.module';
import { DocumentsModule } from './documents/documents.module';
import { SupplyChainController } from './supply-chain/supply-chain.controller';
import { LoadingModule } from './packing/loading.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { WarehouseZonesModule } from './warehouse-zones/warehouse-zones.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { InspectionsModule } from './inspections/inspections.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { ReceivingModule } from './receiving/receiving.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.get<number>('throttle.ttlMs') ?? 60_000,
          limit: config.get<number>('throttle.userLimit') ?? 600,
        },
      ],
    }),
    AuthModule,
    DivisionsModule,
    ContainerTypesModule,
    PackingRulesModule,
    OrdersModule,
    PartsModule,
    ContainersModule,
    HistoryModule,
    ImportsModule,
    DocumentsModule,
    LoadingModule,
    HealthModule,
    InventoryModule,
    WarehouseZonesModule,
    WorkOrdersModule,
    InspectionsModule,
    ShipmentsModule,
    ReceivingModule,
  ],
  controllers: [SupplyChainController],
  providers: [
    { provide: APP_GUARD, useClass: GlobalJwtGuard },
    { provide: APP_GUARD, useClass: MasanAccessGuard },
    { provide: APP_GUARD, useClass: WmsThrottlerGuard },
  ],
})
export class AppModule {}
