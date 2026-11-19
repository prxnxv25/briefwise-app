import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";

const bodySchema = z.object({ name: z.string().trim().min(1).max(80), email: z.email(), password: z.string().min(8).max(100) });
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a name, valid email, and password with at least 8 characters." }, { status: 400 });
  const { name, email, password } = parsed.data;
  try {
    const db = getDb();
    const normalizedEmail = email.toLowerCase();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    await db.insert(users).values({ name, email: normalizedEmail, passwordHash: await hash(password, 12) });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sign up failed." }, { status: 500 }); }
}
