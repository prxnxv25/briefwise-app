import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { generatedDocuments, projects, sections } from "@/db/schema";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { sectionId?: string } | null;
  if (!body?.sectionId) return NextResponse.json({ error: "Choose a version to restore." }, { status: 400 });
  const db = getDb();
  const [target] = await db.select().from(sections).where(eq(sections.id, body.sectionId)).limit(1);
  if (!target) return NextResponse.json({ error: "Version not found." }, { status: 404 });
  const [owner] = await db.select({ id: projects.id }).from(generatedDocuments).innerJoin(projects, eq(projects.id, generatedDocuments.projectId)).where(and(eq(generatedDocuments.id, target.documentId), eq(projects.userId, session.user.id))).limit(1);
  if (!owner) return NextResponse.json({ error: "Version not found." }, { status: 404 });
  const [latest] = await db.select().from(sections).where(and(eq(sections.documentId, target.documentId), eq(sections.sectionKey, target.sectionKey))).orderBy(desc(sections.version)).limit(1);
  await db.update(sections).set({ isCurrent: false }).where(and(eq(sections.documentId, target.documentId), eq(sections.sectionKey, target.sectionKey), eq(sections.isCurrent, true)));
  const [restored] = await db.insert(sections).values({ documentId: target.documentId, sectionKey: target.sectionKey, title: target.title, content: target.content, version: (latest?.version ?? 0) + 1, isCurrent: true }).returning();
  return NextResponse.json({ section: restored });
}
