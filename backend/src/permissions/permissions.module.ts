import { Module } from '@nestjs/common';
import { PermissionsController, PermissionsService } from './permissions.controller.js';

@Module({ controllers: [PermissionsController], providers: [PermissionsService] })
export class PermissionsModule {}
