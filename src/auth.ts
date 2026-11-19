import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [Credentials({
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(credentials) {
      if (typeof credentials.email !== "string" || typeof credentials.password !== "string") return null;
      const [user] = await getDb().select().from(users).where(eq(users.email, credentials.email.toLowerCase())).limit(1);
      if (!user || !(await compare(credentials.password, user.passwordHash))) return null;
      return { id: user.id, name: user.name, email: user.email };
    },
  })],
  callbacks: {
    jwt({ token, user }) { if (user) token.sub = user.id; return token; },
    session({ session, token }) { if (session.user && token.sub) session.user.id = token.sub; return session; },
  },
});
