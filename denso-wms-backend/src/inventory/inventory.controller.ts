import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { OpenCycleDto, RecordCycleDto, ReviewCycleDto } from './dto/cycle-count.dto';
import { CreateDispatchDto } from './dto/create-dispatch.dto';
import { RecordPackingDto } from './dto/record-packing.dto';
import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { QueryHeatmapDto } from './dto/query-heatmap.dto';
import { QueryTransactionSummaryDto } from './dto/query-transaction-summary.dto';
import { InventoryTransactionType } from './entities/inventory-transaction.entity';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('cycle-counts/counters')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  counters() {
    return this.service.cycleCounters();
  }

  @Get('cycle-counts')
  cycles(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listCycles(user);
  }

  @Post('cycle-counts')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  openCycle(@Body() dto: OpenCycleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.openCycle(dto, user);
  }

  @Post('cycle-counts/:id/count')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_STAFF)
  recordCycle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordCycleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.recordCycle(id, dto, user);
  }

  @Post('cycle-counts/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  approveCycle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewCycleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approveCycle(id, dto.reason, user);
  }

  @Post('cycle-counts/:id/void')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  voidCycle(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewCycleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.voidCycle(id, dto.reason, user);
  }

  @Get('dispatches')
  dispatches() {
    return this.service.listDispatches();
  }

  @Get('dispatches/availability')
  availability(@Query('sku') sku?: string) {
    return this.service.dispatchAvailability(sku?.trim() || '');
  }

  @Post('dispatches')
  reserve(@Body() dto: CreateDispatchDto, @CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') key?: string) {
    return this.service.reserveDispatch(dto, user, key);
  }

  @Post('dispatches/:id/pick')
  pick(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.transitionDispatch(id, 'PICKED', user);
  }

  @Get('dispatches/:id/packing')
  packing(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listPacking(id);
  }

  @Post('dispatches/:id/packing')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER)
  pack(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordPackingDto,
       @CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') key?: string) {
    return this.service.recordPacking(id, dto, user, key);
  }

  @Post('dispatches/:id/ship')
  ship(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.transitionDispatch(id, 'SHIPPED', user);
  }

  @Post('dispatches/:id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.transitionDispatch(id, 'CANCELLED', user);
  }

  @Get('transactions')
  list(
    @Query('type') type?: InventoryTransactionType,
    @Query('orderId') orderId?: string,
    @Query('partId') partId?: string,
    @Query('rackId', new ParseUUIDPipe({ optional: true })) rackId?: string,
    @Query('lotId', new ParseUUIDPipe({ optional: true })) lotId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list({ type, orderId, partId, lotId, rackId, limit: limit ? Number(limit) : undefined });
  }

  @Post('transactions')
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Reuse the same key only when retrying the same transaction.' })
  create(
    @Body() dto: CreateInventoryTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.create(dto, user, key);
  }

  @Get('heatmap')
  getHeatmap(@Query() query: QueryHeatmapDto) {
    return this.service.getHeatmap(query);
  }

  @Get('transaction-summary')
  summarize(@Query() query: QueryTransactionSummaryDto) {
    return this.service.transactionSummary(query.days ?? 30, query.zoneCode);
  }
}
