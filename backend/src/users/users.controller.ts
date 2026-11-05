import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UserPageResponse, UserResponse } from './responses.js';
import { Actor, type ActorContext } from '../common/actor.decorator.js';
import { Permissions } from '../rbac/permissions.decorator.js';
import { CreateUserDto, ListUsersQueryDto, RoleIdsDto, UpdateStatusDto, UpdateUserDto } from './dto.js';
import { UsersService } from './users.service.js';

const Id = () => Param('id', new ParseUUIDPipe());

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions('users.read')
  @ApiOkResponse({ type: UserPageResponse })
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @Permissions('users.read')
  @ApiOkResponse({ type: UserResponse })
  get(@Id() id: string) {
    return this.users.get(id);
  }

  @Post()
  @Permissions('users.create')
  @ApiCreatedResponse({ type: UserResponse })
  create(@Actor() actor: ActorContext, @Body() dto: CreateUserDto) {
    return this.users.create(actor, dto);
  }

  @Patch(':id')
  @Permissions('users.update')
  @ApiOkResponse({ type: UserResponse })
  update(@Actor() actor: ActorContext, @Id() id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(actor, id, dto);
  }

  @Patch(':id/status')
  @Permissions('users.update')
  @ApiOkResponse({ type: UserResponse })
  setStatus(@Actor() actor: ActorContext, @Id() id: string, @Body() dto: UpdateStatusDto) {
    return this.users.setStatus(actor, id, dto.status);
  }

  @Put(':id/roles')
  @Permissions('users.assign_roles')
  @ApiOkResponse({ type: UserResponse })
  setRoles(@Actor() actor: ActorContext, @Id() id: string, @Body() dto: RoleIdsDto) {
    return this.users.setRoles(actor, id, dto.role_ids);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Permissions('users.reset_password')
  async resetPassword(@Actor() actor: ActorContext, @Id() id: string) {
    await this.users.requestPasswordReset(actor, id);
    return { message: 'A password reset link has been sent to the user' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('users.delete')
  async remove(@Actor() actor: ActorContext, @Id() id: string): Promise<void> {
    await this.users.remove(actor, id);
  }
}
