import { and, eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { analyses, generatedDocuments, messages, projects, sourceDocuments } from "@/db/schema";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  const [source] = await db.select({ id: sourceDocuments.id, projectId: sourceDocuments.projectId, pathname: sourceDocuments.blobPathname }).from(sourceDocuments)
    .innerJoin(projects, eq(projects.id, sourceDocuments.projectId)).where(and(eq(sourceDocuments.id, id), eq(projects.userId, session.user.id))).limit(1);
  if (!source) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (process.env.BLOB_READ_WRITE_TOKEN) await del(source.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
  await db.delete(analyses).where(eq(analyses.projectId, source.projectId));
  await db.delete(generatedDocuments).where(eq(generatedDocuments.projectId, source.projectId));
  await db.delete(messages).where(eq(messages.projectId, source.projectId));
  await db.delete(sourceDocuments).where(eq(sourceDocuments.id, source.id));
  return NextResponse.json({ ok: true });
}
