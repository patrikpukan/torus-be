import { Injectable } from '@nestjs/common';
import { User, UserRoleEnum } from 'src/modules/users/domain/user';
import { Identity } from 'src/shared/auth/domain/identity';

// simplified ability factory
// only offers basic permissions/checks with basic implementation
// for more robust solution check CASL library integration for NestJS
// its' better to keep your abilities/permissions in one place rather than having them all over the application

export interface AppAbility {
  canCreateUser(): boolean;
  canReadUsers(): boolean;
  canUpdateUser(user: User): boolean;
  canDeleteUser(user: User): boolean;
}

@Injectable()
export class AbilityFactory {
  createForUser(user: Identity): AppAbility {
    const isAdmin = user.role === UserRoleEnum.admin;

    return {
      canCreateUser: (): boolean => isAdmin,
      canReadUsers: (): boolean => true,
      canUpdateUser: (userToUpdate): boolean => {
        return userToUpdate.id === user.id || isAdmin;
      },
      canDeleteUser: (userToDelete): boolean => {
        return userToDelete.id === user.id || isAdmin;
      },
    };
  }
}
