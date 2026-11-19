import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { generatedDocuments, projects, sections } from "@/db/schema";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { documentId?: string; sectionKey?: string; title?: string; content?: string } | null;
  if (!body?.documentId || !body.sectionKey || !body.title || typeof body.content !== "string") return NextResponse.json({ error: "Section details are required." }, { status: 400 });
  const db = getDb();
  const [document] = await db.select({ id: generatedDocuments.id }).from(generatedDocuments).innerJoin(projects, eq(projects.id, generatedDocuments.projectId)).where(and(eq(generatedDocuments.id, body.documentId), eq(projects.userId, session.user.id))).limit(1);
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const [current] = await db.select().from(sections).where(and(eq(sections.documentId, document.id), eq(sections.sectionKey, body.sectionKey), eq(sections.isCurrent, true))).orderBy(desc(sections.version)).limit(1);
  if (current) await db.update(sections).set({ isCurrent: false }).where(eq(sections.id, current.id));
  const [saved] = await db.insert(sections).values({ documentId: document.id, sectionKey: body.sectionKey, title: body.title, content: body.content, version: (current?.version ?? 0) + 1, isCurrent: true }).returning();
  return NextResponse.json({ section: saved });
}
