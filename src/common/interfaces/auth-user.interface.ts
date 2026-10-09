export type UserRole = "super_admin" | "dept_admin" | "member";

export interface MembershipSummary {
  id: string;
  churchId: string;
  role: UserRole;
  badges: string[];
  status: string;
  isBaptized: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  memberships: MembershipSummary[];
}

export interface ChurchScopedRequest {
  user?: AuthUser;
  membership?: MembershipSummary;
}