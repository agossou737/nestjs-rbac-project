import { Module } from '@nestjs/common';
import { LoginHistoryController, LoginHistoryService } from './login-history.controller.js';

@Module({ controllers: [LoginHistoryController], providers: [LoginHistoryService] })
export class LoginHistoryModule {}
