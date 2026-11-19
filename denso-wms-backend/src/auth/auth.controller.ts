import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser } from './types/authenticated-user.type';
import { UserRole } from './entities/user.entity';
import { Roles } from './decorators/roles.decorator';
import { RequirePermissions } from './decorators/permissions.decorator';
import { Permission } from './types/permissions';
import {
  CreateManagedUserDto,
  UpdateManagedUserDto,
  AdminResetPasswordDto,
  ChangePasswordDto,
} from './dto/manage-user.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @RequirePermissions(Permission.USERS_CREATE)
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto.email, dto.password, dto.fullName);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    const ip = req.ip || req.socket.remoteAddress || undefined;
    const ua = req.headers['user-agent'] || undefined;
    return this.authService.login(dto.username || dto.email || '', dto.password, ip, ua);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    return this.authService.me(user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return { message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.' };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Đặt lại mật khẩu thành công.' };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || undefined;
    const ua = req.headers['user-agent'] || undefined;
    return this.authService.changePassword(user.id, dto, ip, ua);
  }

  // --- User Management & RBAC ---

  @ApiBearerAuth()
  @RequirePermissions(Permission.USERS_READ)
  @Get('users')
  users() {
    return this.authService.listUsers();
  }

  @ApiBearerAuth()
  @RequirePermissions(Permission.USERS_READ)
  @Get('users/:id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.authService.getUser(id);
  }

  @ApiBearerAuth()
  @RequirePermissions(Permission.USERS_CREATE)
  @Post('users')
  createUser(
    @Body() dto: CreateManagedUserDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || undefined;
    const ua = req.headers['user-agent'] || undefined;
    return this.authService.createManagedUser(dto, admin, ip, ua);
  }

  @ApiBearerAuth()
  @RequirePermissions(Permission.USERS_UPDATE)
  @Patch('users/:id')
  patchUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateManagedUserDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || undefined;
    const ua = req.headers['user-agent'] || undefined;
    return this.authService.updateManagedUser(id, dto, admin, ip, ua);
  }

  @ApiBearerAuth()
  @RequirePermissions(Permission.USERS_PASSWORD_RESET)
  @Post('users/:id/reset-password')
  adminResetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || undefined;
    const ua = req.headers['user-agent'] || undefined;
    return this.authService.adminResetPassword(id, dto, admin, ip, ua);
  }

  @ApiBearerAuth()
  @RequirePermissions(Permission.USERS_UPDATE)
  @Post('users/:id/revoke-sessions')
  revokeUserSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || undefined;
    const ua = req.headers['user-agent'] || undefined;
    return this.authService.revokeUserSessions(id, admin, ip, ua);
  }

  @ApiBearerAuth()
  @RequirePermissions(Permission.AUDIT_READ)
  @Get('audit-logs')
  auditLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('targetUserId') targetUserId?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 50;
    const off = offset ? parseInt(offset, 10) : 0;
    return this.authService.listSecurityEvents(lim, off, targetUserId);
  }

  @Get('roles-metadata')
  rolesMetadata() {
    return this.authService.getRolesAndPermissionsMetadata();
  }
}
