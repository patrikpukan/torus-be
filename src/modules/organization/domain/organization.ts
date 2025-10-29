export type Organization = {
  id: string;
  name: string;
  code: string;
  size?: number | null;
  address?: string | null;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationWithAdmin = Organization & {
  adminUser: {
    id: string;
    email: string;
    username: string;
  };
};
