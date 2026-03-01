import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // 1 dia
  },
  secret: process.env.BETTER_AUTH_SECRET || "change-this-secret-key-in-production",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  basePath: "/api/auth",
  trustedOrigins: [
    process.env.FRONTEND_URL || "http://localhost:3001",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173", // Mantido para compatibilidade
  ],
});

export type Session = typeof auth.$Infer.Session;
