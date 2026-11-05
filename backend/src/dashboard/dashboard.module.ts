import { Module } from '@nestjs/common';
import { DashboardController, DashboardService } from './dashboard.controller.js';

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
