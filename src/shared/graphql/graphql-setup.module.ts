import { join } from 'path';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ConfigModule } from '@applifting-io/nestjs-decorated-config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Logger, Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { AuthModule } from 'src/shared/auth/auth.module';
import { BetterAuth } from '../auth/providers/better-auth.provider';
import { getSessionFromRequest } from '../auth/utils/get-session-from-request';
import { Config } from '../config/config.service';

const logger = new Logger('GraphqlSetupModule');

@Module({
  imports: [
    GraphQLModule.forRootAsync({
      imports: [AuthModule, ConfigModule],
      inject: [Config, 'BetterAuth'],
      driver: ApolloDriver,
      useFactory: (
        config: Config,
        betterAuth: BetterAuth,
      ): ApolloDriverConfig => {
        return {
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          playground: false,
          introspection: true,
          context: async ({
            req,
            res,
            extra,
          }): Promise<{
            req: Request;
            res: Response;
            // todo: figure out proper typing here
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extra: any;
          }> => {
            return {
              req: extra?.request ?? req,
              res,
              extra,
            };
          },
          plugins: [
            ApolloServerPluginLandingPageLocalDefault({
              includeCookies: true,
              embed: true,
            }),
          ],
          subscriptions: {
            'graphql-ws': {
              // todo: add proper type for context
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onConnect: async (context: any): Promise<any> => {
                logger.log('Subscription connection established');

                const { extra } = context;
                /* parse user from cookies on connection using the JwtStrategy
                Todo: Not entirely sure that this is the best way to achieve it. It seems to retain the user even when logged out. Wasn't able to make the strategy work on it's own
                Todo: Maybe move this code to the AuthenticatedUserGuard?
                 */

                // todo: test this
                const session = await getSessionFromRequest(
                  extra.request,
                  betterAuth,
                );

                extra.request.session = session;
                return context;
              },
            },
          },
        };
      },
    }),
  ],
})
export class GraphqlSetupModule {}
