import type { CreateAdminUserDto, UpdateAdminUserDto } from '@academy/contracts';
import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import type { PublicAuthUser } from '../../auth/application/auth.repository';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { parseUuid } from '../../shared/presentation/request-validation';
import { UsersService } from '../application/users.service';

@Controller('users')
@Permissions('users:manage')
export class UsersController {
  constructor(@Inject(UsersService) private readonly service: UsersService) {}
  @Get() list(@CurrentUser() actor: PublicAuthUser) {
    return this.service.list(actor);
  }
  @Get(':id') get(@CurrentUser() actor: PublicAuthUser, @Param('id') id: string) {
    return this.service.get(actor, parseUuid(id));
  }
  @Post() create(@CurrentUser() actor: PublicAuthUser, @Body() input: CreateAdminUserDto) {
    return this.service.create(actor, input);
  }
  @Patch(':id') update(
    @CurrentUser() actor: PublicAuthUser,
    @Param('id') id: string,
    @Body() input: UpdateAdminUserDto,
  ) {
    return this.service.update(actor, parseUuid(id), input);
  }
}
