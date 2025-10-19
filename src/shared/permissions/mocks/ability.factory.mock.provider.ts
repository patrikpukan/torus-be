import { AbilityFactory } from '../factory/ability.factory';

export const abilityFactoryMockProvider = {
  provide: AbilityFactory,
  useClass: AbilityFactory, // this will need to change once CaslAbilityFactory will have some dependencies (e.g. will be provided from database/3rd party service)
};
