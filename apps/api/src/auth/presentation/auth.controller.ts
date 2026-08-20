import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { AuthCredentialsDto } from '@academy/contracts';
import { AuthService } from '../application/auth.service';
import { Public } from './public.decorator';
import { readSessionToken } from './session-token';

type HttpResponse = {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
};
type HttpRequest = { headers: Record<string, string | string[] | undefined>; adminUser?: unknown };
const cookieOptions = (expires?: Date) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  ...(expires ? { expires } : {}),
});

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Get('setup-status')
  async setupStatus() {
    return { required: await this.auth.setupRequired() };
  }

  @Public()
  @Post('bootstrap')
  async bootstrap(
    @Body() body: AuthCredentialsDto,
    @Res({ passthrough: true }) response: HttpResponse,
  ) {
    const result = await this.auth.bootstrap(body?.username, body?.password);
    response.cookie('academy_session', result.token, cookieOptions(result.expiresAt));
    return { user: result.user, expiresAt: result.expiresAt };
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() body: AuthCredentialsDto,
    @Res({ passthrough: true }) response: HttpResponse,
  ) {
    const result = await this.auth.login(body?.username, body?.password);
    response.cookie('academy_session', result.token, cookieOptions(result.expiresAt));
    return { user: result.user, expiresAt: result.expiresAt };
  }

  @Get('me')
  me(@Req() request: HttpRequest) {
    return { user: request.adminUser };
  }

  @HttpCode(204)
  @Post('logout')
  async logout(
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<void> {
    await this.auth.logout(readSessionToken(request.headers));
    response.clearCookie('academy_session', cookieOptions());
  }
}
