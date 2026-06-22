import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create system roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: "super_admin" },
    update: {},
    create: {
      name: "super_admin",
      description: "System administrator with full access",
      isSystem: true,
    },
  });

  const companyAdminRole = await prisma.role.upsert({
    where: { name: "company_admin" },
    update: {},
    create: {
      name: "company_admin",
      description: "Company administrator",
      isSystem: true,
    },
  });

  const employeeRole = await prisma.role.upsert({
    where: { name: "employee" },
    update: {},
    create: {
      name: "employee",
      description: "Regular employee",
      isSystem: true,
    },
  });

  // Create permissions
  const permissions = [
    "users:create",
    "users:read",
    "users:update",
    "users:delete",
    "employees:create",
    "employees:read",
    "employees:update",
    "employees:delete",
    "inventory:read",
    "inventory:write",
    "sales:read",
    "sales:write",
    "purchase:read",
    "purchase:write",
    "accounting:read",
    "accounting:write",
    "reports:read",
  ];

  for (const permissionName of permissions) {
    await prisma.permission.upsert({
      where: { name: permissionName },
      update: {},
      create: {
        name: permissionName,
        description: `Permission: ${permissionName}`,
      },
    });
  }

  // Create demo company
  const company = await prisma.company.upsert({
    where: { email: "demo@erpsaas.com" },
    update: {},
    create: {
      name: "Demo Company",
      email: "demo@erpsaas.com",
      phone: "+1-555-0100",
      address: "123 Business Street",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "USA",
      website: "https://democompany.com",
      industry: "Technology",
      size: "medium",
      subscriptionPlan: "pro",
      subscriptionUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    },
  });

  // Create demo admin user
  const hashedPassword = await bcrypt.hash("demo@123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      firstName: "Admin",
      lastName: "User",
      password: hashedPassword,
      isEmailVerified: true,
      isActive: true,
      companyId: company.id,
      roleId: companyAdminRole.id,
    },
  });

  console.log("✅ Seeding completed successfully!");
  console.log(`Created company: ${company.name}`);
  console.log(`Created user: ${adminUser.email}`);
  console.log(`\nDemo credentials:\n  Email: admin@demo.com\n  Password: demo@123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
