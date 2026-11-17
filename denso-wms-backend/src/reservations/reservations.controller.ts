import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { MasanAccessGuard } from '../auth/guards/masan-access.guard';

@Controller('api/reservations')
@UseGuards(MasanAccessGuard)
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  /** GET /api/reservations/summary – list all parts with ATP */
  @Get('summary')
  async listSummaries() {
    return this.service.listAllSummaries();
  }

  /** GET /api/reservations/summary/:partId – single part ATP */
  @Get('summary/:partId')
  async getPartSummary(@Param('partId') partId: string) {
    return this.service.getStockSummary(partId);
  }

  /** GET /api/reservations – list reservations with optional filters */
  @Get()
  async listReservations(
    @Query('partId') partId?: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    return this.service.listReservations({ partId, status });
  }

  /** POST /api/reservations – create a soft reservation */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateReservationDto, @Request() req: any) {
    const reservedBy: string = req.user?.email || req.user?.sub || 'unknown';
    return this.service.createReservation(dto, reservedBy);
  }

  /** PATCH /api/reservations/:id/cancel – cancel a reservation */
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req: any) {
    const user: string = req.user?.email || req.user?.sub || 'unknown';
    const role: string = req.user?.role || 'warehouse_staff';
    return this.service.cancelReservation(id, user, role);
  }

  /** PATCH /api/reservations/:id/confirm-picking – confirm picking (deduct stock) */
  @Patch(':id/confirm-picking')
  async confirmPicking(@Param('id') id: string, @Request() req: any) {
    const user: string = req.user?.email || req.user?.sub || 'unknown';
    return this.service.confirmPicking(id, user);
  }

  /** POST /api/reservations/expire – trigger expiry check */
  @Post('expire')
  async expireOverdue() {
    const count = await this.service.expireOverdue();
    return { expired: count };
  }
}
