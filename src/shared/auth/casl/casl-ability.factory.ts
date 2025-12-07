import {
  Ability,
  AbilityBuilder,
  AbilityClass,
  ExtractSubjectType,
  InferSubjects,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { Identity } from '../domain/identity';
import { UserRoleEnum } from 'src/modules/users/domain/user';

/**
 * Subject types that can be managed through CASL.
 * These represent different resources in the application that need authorization checks.
 */
type Subjects =
  | InferSubjects<typeof Object>
  | 'Organization'
  | 'User'
  | 'Pairing'
  | 'PairingPeriod'
  | 'AlgorithmSettings'
  | 'CalendarEvent'
  | 'MeetingEvent'
  | 'InviteCode'
  | 'Report'
  | 'Department'
  | 'all';

/**
 * Action types that can be performed on subjects.
 * manage = full control, read = view only, create, update, delete as needed.
 */
export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';

/**
 * CASL Ability type for this application.
 * Defines what actions can be performed on what subjects.
 */
export type AppAbility = Ability<[Actions, Subjects]>;

/**
 * CASL Ability Factory
 *
 * This factory creates ability objects based on user role.
 * It defines granular permissions for each role across all subjects.
 *
 * PERMISSION MODEL:
 * - super_admin: Full access to everything (can('manage', 'all'))
 * - org_admin: Can manage organization members, settings, algorithm
 * - user: Limited access - can only view own profile and manage own calendar
 *
 * ABILITY RULES FLOW:
 * 1. Ability matches rules in order (first match wins)
 * 2. Implicit: any action not granted is denied
 * 3. Subjects can be class or string identifier
 *
 * @example
 * const ability = factory.createForUser(user);
 * if (ability.can('manage', 'Organization')) { ... }
 * if (ability.can('read', organizationInstance)) { ... }
 */
@Injectable()
export class CaslAbilityFactory {
  /**
   * Creates an ability object for a given user.
   * Maps the user's role to specific permissions.
   *
   * @param identity - Current user's identity with role information
   * @returns Configured Ability instance with user's permissions
   */
  createForUser(identity: Identity): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      Ability as AbilityClass<AppAbility>
    );

    // Grant permissions based on user role
    switch (identity.role) {
      case UserRoleEnum.super_admin:
        return this.defineSuperAdminAbilities(can, cannot, build);

      case UserRoleEnum.org_admin:
        return this.defineOrgAdminAbilities(can, cannot, build, identity);

      case UserRoleEnum.user:
      default:
        return this.defineUserAbilities(can, cannot, build, identity);
    }
  }

  /**
   * Super Admin Abilities
   *
   * Super admins can perform any action on any subject.
   * This is the highest privilege level.
   */
  private defineSuperAdminAbilities(
    can: any,
    cannot: any,
    build: any
  ): AppAbility {
    // Full access to everything
    can('manage', 'all');

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }

  /**
   * Organization Admin Abilities
   *
   * Organization admins can:
   * - Manage their own organization
   * - Manage users within their organization
   * - Configure algorithm settings for their organization
   * - Create and manage pairing periods
   * - View and manage invitations
   * - View reports within their organization
   */
  private defineOrgAdminAbilities(
    can: any,
    cannot: any,
    build: any,
    identity: Identity
  ): AppAbility {
    // Can manage own organization
    can('manage', 'Organization', { id: identity.organizationId });
    can('read', 'Organization');

    // Can manage users in their organization
    can('read', 'User', { organizationId: identity.organizationId });
    can('update', 'User', { organizationId: identity.organizationId });
    can('delete', 'User', { organizationId: identity.organizationId });
    cannot('create', 'User'); // Users sign up themselves

    // Can manage algorithm settings for their organization
    can('manage', 'AlgorithmSettings', { organizationId: identity.organizationId });

    // Can manage pairing periods for their organization
    can('manage', 'PairingPeriod', { organizationId: identity.organizationId });

    // Can manage pairings within their organization
    can('manage', 'Pairing', { organizationId: identity.organizationId });

    // Can manage invite codes for their organization
    can('manage', 'InviteCode', { organizationId: identity.organizationId });

    // Can create and read reports for their organization
    can('create', 'Report', { organizationId: identity.organizationId });
    can('read', 'Report', { organizationId: identity.organizationId });
    can('update', 'Report', { organizationId: identity.organizationId });

    // Can manage departments for their organization
    can('manage', 'Department', { organizationId: identity.organizationId });

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }

  /**
   * Regular User Abilities
   *
   * Regular users can:
   * - Read their own user profile
   * - Create, read, update, delete their own calendar events
   * - Create and read their own meeting events (in context of pairing)
   * - Read pairings they're involved in
   * - Cannot manage organization settings
   */
  private defineUserAbilities(
    can: any,
    cannot: any,
    build: any,
    identity: Identity
  ): AppAbility {
    // Can read own user profile
    can('read', 'User', { id: identity.id });
    can('update', 'User', { id: identity.id });

    // Can manage own calendar events
    can('create', 'CalendarEvent', { userId: identity.id });
    can('read', 'CalendarEvent', { userId: identity.id });
    can('update', 'CalendarEvent', { userId: identity.id });
    can('delete', 'CalendarEvent', { userId: identity.id });

    // Can manage own meeting events (meetings they're part of)
    // Note: MeetingEvent access should be checked via userAId or userBId
    can('read', 'MeetingEvent', { userAId: identity.id });
    can('read', 'MeetingEvent', { userBId: identity.id });
    can('update', 'MeetingEvent', { userAId: identity.id });
    can('update', 'MeetingEvent', { userBId: identity.id });

    // Can read their own organization (basic info)
    can('read', 'Organization', { id: identity.organizationId });

    // Cannot perform admin actions
    cannot('manage', 'AlgorithmSettings');
    cannot('manage', 'PairingPeriod');
    cannot('manage', 'Report');
    cannot('manage', 'InviteCode');
    cannot('manage', 'Department');

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
