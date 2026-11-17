import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  ApproveDiscrepancyDto,
  CreateReceivingReceiptDto,
  QueryReceivingReceiptsDto,
} from './dto/create-receiving-receipt.dto';
import { ReceivingService } from './receiving.service';

@ApiTags('Receiving Receipts & Discrepancies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('receiving')
export class ReceivingController {
  constructor(private readonly service: ReceivingService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo phiếu nhận hàng & đối chiếu sai lệch PO' })
  create(@Body() dto: CreateReceivingReceiptDto, @CurrentUser() user: AuthenticatedUser,
         @Headers('idempotency-key') key?: string) {
    return this.service.create(dto, user, key);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách phiếu nhận hàng' })
  findAll(@Query() query: QueryReceivingReceiptsDto) {
    return this.service.findAll(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Thống kê biên bản sai lệch nhận hàng' })
  getSummary() {
    return this.service.getDiscrepancySummary();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết phiếu nhận hàng' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Duyệt biên bản sai lệch nhận hàng (Manager / Admin)' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveDiscrepancyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approveDiscrepancy(id, user, dto);
  }
}
