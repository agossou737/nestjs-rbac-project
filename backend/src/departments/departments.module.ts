import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller.js';
import { DepartmentsService } from './departments.service.js';

@Module({
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  // UsersModule needs DepartmentsService to check a department before attaching an account to it.
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
