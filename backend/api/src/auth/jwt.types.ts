export type AccessJwtPayload = {
  sub: string;
  organizationId: string;
  permissions: string[];
  role: string;
  branchScope: string;
  riderId?: string;
};
