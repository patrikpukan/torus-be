import { Config } from '../../config/config.service';
import { OrgAdminRepository } from '../repositories/org-admin.repository';
import { UserRoleEnum } from 'src/modules/users/domain/user';

export const isSystemAdmin = (
  role?: string | null,
  email?: string,
  config?: Config,
): boolean => {
  if (role === UserRoleEnum.systemAdmin) {
    return true;
  }

  if (!email || !config?.superadminEmail) {
    return false;
  }

  return config.superadminEmail.toLowerCase() === email.toLowerCase();
};

export const isOrgAdmin = async (
  orgAdminRepository: OrgAdminRepository,
  role?: string | null,
  email?: string,
): Promise<boolean> => {
  if (role === UserRoleEnum.orgAdmin) {
    return true;
  }

  if (!email) {
    return false;
  }

  return orgAdminRepository.isOrgAdmin(email);
};
