import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/core/prisma/prisma.module';
import { PubSubModule } from 'src/core/pub-sub/pub-sub.module';
import { AuthModule } from 'src/shared/auth/auth.module';
import { Config } from 'src/shared/config/config.service';
import { PermissionsModule } from '../../shared/permissions/permissions.module';
import { QuackResolver } from './graphql/resolvers/quack.resolver';
import { UserQuacksResolver } from './graphql/resolvers/user-quacks.resolver';
import { QuackRepository } from './repositories/quack.repository';
import { QuacksService } from './services/quacks.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    PermissionsModule,
    // todo: maybe remove this? It's mostly for REST controllers
    CacheModule.registerAsync({
      useFactory: (config: Config) => ({
        // we cannot use `isGlobal: true` here because of the `CacheInterceptor` not working with GraphQL
        ttl: config.cacheTtlMs,
        max: config.cacheMaxItems,
      }),
      inject: [Config],
    }),
    PubSubModule,
  ],
  providers: [
    QuacksService,
    QuackResolver,
    QuackRepository,
    UserQuacksResolver,
  ],
})
export class QuackModule {}
