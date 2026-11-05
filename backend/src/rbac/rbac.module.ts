import { Global, Module } from '@nestjs/common';
import { AccessPolicy } from './access-policy.service.js';
import { RbacService } from './rbac.service.js';

@Global()
@Module({
  providers: [RbacService, AccessPolicy],
  exports: [RbacService, AccessPolicy],
})
export class RbacModule {}
