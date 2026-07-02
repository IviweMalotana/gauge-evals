import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma client. In dev, Next.js hot-reloads modules which would
 * otherwise open a new connection pool on every reload, so we cache it on the
 * global object.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
