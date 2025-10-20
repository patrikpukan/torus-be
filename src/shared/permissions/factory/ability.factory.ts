import {Injectable} from '@nestjs/common';
import {User, UserRoleEnum} from 'src/modules/users/domain/user';
import {Identity} from 'src/shared/auth/domain/identity';

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
    const isSuperAdmin = user.role === UserRoleEnum.superAdmin;
    const isOrgAdmin = user.role === UserRoleEnum.orgAdmin;
    const hasElevatedPrivileges = isSuperAdmin || isOrgAdmin;

    return {
      canCreateUser: (): boolean => hasElevatedPrivileges,
      canReadUsers: (): boolean => true,
      canUpdateUser: (userToUpdate): boolean => {
        return userToUpdate.id === user.id || hasElevatedPrivileges;
      },
      canDeleteUser: (userToDelete): boolean => {
        return userToDelete.id === user.id || hasElevatedPrivileges;
      },
    };
  }
}
