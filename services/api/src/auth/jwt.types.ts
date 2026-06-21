export type AccessJwtPayload = {
  sub: string;
  organizationId: string;
  permissions: string[];
};
