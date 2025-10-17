import { Module } from '@nestjs/common';
import { AbilityFactory } from './factory/ability.factory';

@Module({
  providers: [AbilityFactory],
  exports: [AbilityFactory],
})
export class PermissionsModule {}
