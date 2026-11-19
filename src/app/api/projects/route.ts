import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { projects, sourceDocuments } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await getDb().select({ id: projects.id, name: projects.name, createdAt: projects.createdAt, updatedAt: projects.updatedAt, sourceName: sourceDocuments.originalName })
    .from(projects).leftJoin(sourceDocuments, eq(sourceDocuments.projectId, projects.id)).where(eq(projects.userId, session.user.id)).orderBy(desc(projects.updatedAt));
  return NextResponse.json({ projects: rows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { name?: string } | null;
  const name = body?.name?.trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "Enter a project name." }, { status: 400 });
  const [project] = await getDb().insert(projects).values({ userId: session.user.id, name }).returning();
  return NextResponse.json({ project }, { status: 201 });
}
