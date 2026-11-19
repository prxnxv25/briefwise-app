import { del, get } from "@vercel/blob";
import { handleUpload } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { analyses, chunks, generatedDocuments, messages, projects, sourceDocuments } from "@/db/schema";
import { extractText } from "@/lib/extract";
import { splitIntoChunks } from "@/lib/documents";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_FILE = 8 * 1024 * 1024;
const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

export async function POST(request: Request) {
  const session = await auth();
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Connect a private Vercel Blob store and set BLOB_READ_WRITE_TOKEN." }, { status: 503 });
  try {
    const body = await request.json();
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!session?.user?.id) throw new Error("Unauthorized");
        const payload = JSON.parse(clientPayload || "{}") as { projectId?: string; originalName?: string; mimeType?: string };
        if (!payload.projectId || !payload.originalName) throw new Error("Missing project or filename.");
        const [project] = await getDb().select({ id: projects.id }).from(projects).where(and(eq(projects.id, payload.projectId), eq(projects.userId, session.user.id))).limit(1);
        if (!project) throw new Error("Project not found.");
        if (!/\.(pdf|docx?)$/i.test(payload.originalName)) throw new Error("Unsupported file format. Upload a Word (.doc or .docx) or PDF file.");
        return {
          allowedContentTypes: allowedTypes,
          maximumSizeInBytes: MAX_FILE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id, projectId: project.id, originalName: payload.originalName, mimeType: payload.mimeType ?? "application/octet-stream" }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(tokenPayload || "{}") as { userId?: string; projectId?: string; originalName?: string; mimeType?: string };
        if (!payload.userId || !payload.projectId || !payload.originalName) throw new Error("Upload ownership could not be verified.");
        const [project] = await getDb().select({ id: projects.id }).from(projects).where(and(eq(projects.id, payload.projectId), eq(projects.userId, payload.userId))).limit(1);
        if (!project) throw new Error("Project no longer exists.");
        const stored = await get(blob.pathname, { access: "private" });
        if (!stored || stored.statusCode !== 200) throw new Error("Uploaded file could not be read from private storage.");
        const bytes = Buffer.from(await new Response(stored.stream).arrayBuffer());
        const text = await extractText(payload.originalName, bytes);
        const db = getDb();
        const oldDocuments = await db.select({ pathname: sourceDocuments.blobPathname }).from(sourceDocuments).where(eq(sourceDocuments.projectId, payload.projectId));
        await Promise.all(oldDocuments.map(({ pathname }) => del(pathname).catch(() => undefined)));
        await db.delete(analyses).where(eq(analyses.projectId, payload.projectId));
        await db.delete(generatedDocuments).where(eq(generatedDocuments.projectId, payload.projectId));
        await db.delete(messages).where(eq(messages.projectId, payload.projectId));
        await db.delete(sourceDocuments).where(eq(sourceDocuments.projectId, payload.projectId));
        const [doc] = await db.insert(sourceDocuments).values({ projectId: payload.projectId, originalName: payload.originalName, mimeType: payload.mimeType ?? blob.contentType ?? "application/octet-stream", blobPathname: blob.pathname, extractedText: text }).returning({ id: sourceDocuments.id });
        await db.insert(chunks).values(splitIntoChunks(text).map((content, chunkIndex) => ({ documentId: doc.id, content, chunkIndex })));
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
