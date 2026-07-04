import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

/**
 * Seeds a demo company with an owner and a couple of teammates so you can log in
 * immediately. Idempotent: safe to run repeatedly.
 *
 *   Owner login:  ada@acme.test  /  password123
 */
async function main() {
  const email = "ada@acme.test";
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed already applied — owner exists:", email);
    return;
  }

  const passwordHash = await bcrypt.hash("password123", 10);

  const owner = await db.user.create({
    data: {
      email,
      name: "Ada Lovelace",
      passwordHash,
      memberships: {
        create: {
          role: "OWNER",
          company: { create: { name: "Acme Inc.", slug: "acme" } },
        },
      },
    },
    include: { memberships: true },
  });

  const companyId = owner.memberships[0].companyId;

  // A couple of teammates.
  const grace = await db.user.create({
    data: {
      email: "grace@acme.test",
      name: "Grace Hopper",
      passwordHash: await bcrypt.hash("password123", 10),
    },
  });
  const stan = await db.user.create({
    data: {
      email: "stan@acme.test",
      name: "Stan Stakeholder",
      passwordHash: await bcrypt.hash("password123", 10),
    },
  });
  await db.membership.createMany({
    data: [
      { userId: grace.id, companyId, role: "COLLABORATOR" },
      { userId: stan.id, companyId, role: "STAKEHOLDER" },
    ],
  });

  console.log("Seeded company 'Acme Inc.'");
  console.log("  Owner:       ada@acme.test / password123");
  console.log("  Collaborator grace@acme.test / password123");
  console.log("  Stakeholder  stan@acme.test / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
