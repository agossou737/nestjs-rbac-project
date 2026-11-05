import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RoleDetailResponse, RolePageResponse } from './responses.js';
import { Actor, type ActorContext } from '../common/actor.decorator.js';
import { Permissions } from '../rbac/permissions.decorator.js';
import { CreateRoleDto, DuplicateRoleDto, ListRolesQueryDto, PermissionKeysDto, UpdateRoleDto } from './dto.js';
import { RolesService } from './roles.service.js';

const Id = () => Param('id', new ParseUUIDPipe());

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @Permissions('roles.read')
  @ApiOkResponse({ type: RolePageResponse })
  list(@Query() query: ListRolesQueryDto) {
    return this.roles.list(query);
  }

  @Get(':id')
  @Permissions('roles.read')
  @ApiOkResponse({ type: RoleDetailResponse })
  get(@Id() id: string) {
    return this.roles.get(id);
  }

  @Post()
  @Permissions('roles.create')
  @ApiCreatedResponse({ type: RoleDetailResponse })
  create(@Actor() actor: ActorContext, @Body() dto: CreateRoleDto) {
    return this.roles.create(actor, dto);
  }

  @Post(':id/duplicate')
  @Permissions('roles.create')
  @ApiCreatedResponse({ type: RoleDetailResponse })
  duplicate(@Actor() actor: ActorContext, @Id() id: string, @Body() dto: DuplicateRoleDto) {
    return this.roles.duplicate(actor, id, dto.name);
  }

  @Patch(':id')
  @Permissions('roles.update')
  @ApiOkResponse({ type: RoleDetailResponse })
  update(@Actor() actor: ActorContext, @Id() id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(actor, id, dto);
  }

  @Put(':id/permissions')
  @Permissions('roles.update')
  @ApiOkResponse({ type: RoleDetailResponse })
  setPermissions(@Actor() actor: ActorContext, @Id() id: string, @Body() dto: PermissionKeysDto) {
    return this.roles.setPermissions(actor, id, dto.permissions);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('roles.delete')
  async remove(@Actor() actor: ActorContext, @Id() id: string): Promise<void> {
    await this.roles.remove(actor, id);
  }
}
