export type AccessJwtPayload = {
  sub: string;
  organizationId: string;
  permissions: string[];
  role: string;
  branchScope: string;
  /** null/undefined = all permission-gated paths; otherwise only listed paths. */
  navAllowlist?: string[] | null;
  riderId?: string;
};
