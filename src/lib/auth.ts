import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";
import { db } from "./db";
import type { Role } from "./domain";

const SESSION_COOKIE = "gauge_session";
const secret = new TextEncoder().encode(env.AUTH_SECRET);

export interface SessionPayload {
  userId: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function destroySession(): void {
  cookies().delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string, email: payload.email as string };
  } catch {
    return null;
  }
}

/** Full current-user context including the active company membership. */
export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  companyId: string;
  companyName: string;
  companySlug: string;
  role: Role;
}

/**
 * Resolves the signed-in user and their (first) company membership. Returns
 * null when unauthenticated or the user belongs to no company.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { memberships: { include: { company: true }, take: 1 } },
  });
  if (!user || user.memberships.length === 0) return null;

  const membership = user.memberships[0];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    companyId: membership.companyId,
    companyName: membership.company.name,
    companySlug: membership.company.slug,
    role: membership.role as Role,
  };
}

/** Role helpers — keep authorization checks readable at call sites. */
export const can = {
  manageMembers: (role: Role) => role === "OWNER" || role === "ADMIN",
  manageCompany: (role: Role) => role === "OWNER" || role === "ADMIN",
  runPipeline: (role: Role) =>
    role === "OWNER" || role === "ADMIN" || role === "COLLABORATOR",
  fileRequests: (_role: Role) => true,
};
