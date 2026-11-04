import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Actual JWT verification is performed by JwtStrategy (signed access token).
export const PUBLIC_USER_ID = '00000000-0000-0000-0000-000000000000';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
