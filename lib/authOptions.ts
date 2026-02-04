import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const rows = await sql`
          select id, email, name, tenant_id, password_hash
          from app_users
          where email = ${email}
          limit 1
        `;
        const u: any = (rows as any[])[0];
        if (!u) return null;

        const ok = await bcrypt.compare(password, u.password_hash);
        if (!ok) return null;

        return {
          id: u.id,
          email: u.email,
          name: u.name ?? "",
          tenantId: u.tenant_id,
        } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).tenantId = (user as any).tenantId;
        token.name = (user as any).name ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).tenantId = (token as any).tenantId;
      return session;
    },
  },

  pages: { signIn: "/login" },
};

