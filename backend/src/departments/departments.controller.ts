import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Actor, type ActorContext } from '../common/actor.decorator.js';
import { Permissions } from '../rbac/permissions.decorator.js';
import { DepartmentsService } from './departments.service.js';
import { CreateDepartmentDto, ListDepartmentsQueryDto, UpdateDepartmentDto } from './dto.js';
import { DepartmentPageResponse, DepartmentResponse } from './responses.js';

const Id = () => Param('id', new ParseUUIDPipe());

// Thin by design: read the request, call the service. Every rule lives in DepartmentsService.
@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @Permissions('departments.read')
  @ApiOkResponse({ type: DepartmentPageResponse })
  list(@Query() query: ListDepartmentsQueryDto) {
    return this.departments.list(query);
  }

  @Get(':id')
  @Permissions('departments.read')
  @ApiOkResponse({ type: DepartmentResponse })
  get(@Id() id: string) {
    return this.departments.get(id);
  }

  @Post()
  @Permissions('departments.create')
  @ApiCreatedResponse({ type: DepartmentResponse })
  create(@Actor() actor: ActorContext, @Body() dto: CreateDepartmentDto) {
    return this.departments.create(actor, dto);
  }

  @Patch(':id')
  @Permissions('departments.update')
  @ApiOkResponse({ type: DepartmentResponse })
  update(@Actor() actor: ActorContext, @Id() id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departments.update(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('departments.delete')
  async remove(@Actor() actor: ActorContext, @Id() id: string): Promise<void> {
    await this.departments.remove(actor, id);
  }
}
