import { and, asc, eq, inArray } from "drizzle-orm";
import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { analyses, generatedDocuments, projects, sections, sourceDocuments } from "@/db/schema";
import { getBlobReadWriteToken } from "@/lib/blob";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  const [project] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, session.user.id))).limit(1);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const [source] = await db.select({ id: sourceDocuments.id, originalName: sourceDocuments.originalName, mimeType: sourceDocuments.mimeType, createdAt: sourceDocuments.createdAt })
    .from(sourceDocuments).where(eq(sourceDocuments.projectId, id)).orderBy(asc(sourceDocuments.createdAt)).limit(1);
  const [analysis] = await db.select().from(analyses).where(eq(analyses.projectId, id)).limit(1);
  const docs = await db.select().from(generatedDocuments).where(eq(generatedDocuments.projectId, id)).orderBy(asc(generatedDocuments.createdAt));
  const sectionsByDoc = docs.length ? await db.select().from(sections).where(inArray(sections.documentId, docs.map((item) => item.id))).orderBy(asc(sections.createdAt)) : [];
  return NextResponse.json({ project, source: source ?? null, analysis: analysis ?? null, documents: docs, sections: sectionsByDoc });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  const owned = await db.select({ pathname: sourceDocuments.blobPathname }).from(sourceDocuments).innerJoin(projects, eq(projects.id, sourceDocuments.projectId)).where(and(eq(projects.id, id), eq(projects.userId, session.user.id)));
  const blobToken = getBlobReadWriteToken();
  if (blobToken) await Promise.all(owned.map(({ pathname }) => del(pathname, { token: blobToken }).catch(() => undefined)));
  const deleted = await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, session.user.id))).returning({ id: projects.id });
  if (!deleted.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
