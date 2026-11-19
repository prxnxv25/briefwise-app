import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { generatedDocuments, projects, sections } from "@/db/schema";
import { PrintButton } from "@/components/print-button";
import { MarkdownContent } from "@/components/markdown-content";

export default async function PrintDocument({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ doc?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const { doc: docId } = await searchParams;
  if (!docId) notFound();
  const db = getDb();
  const [project] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, session.user.id))).limit(1);
  const [doc] = await db.select().from(generatedDocuments).where(and(eq(generatedDocuments.id, docId), eq(generatedDocuments.projectId, id))).limit(1);
  if (!project || !doc) notFound();
  const rows = await db.select().from(sections).where(and(eq(sections.documentId, doc.id), eq(sections.isCurrent, true))).orderBy(asc(sections.createdAt));
  return <main className="print-shell"><div className="print-toolbar"><Link href={`/projects/${id}`}>← Back to project</Link><PrintButton /></div><article className="print-document"><div className="print-kicker">{doc.kind} · PROJECT DOCUMENT</div><h1>{doc.title}</h1><p className="print-subtitle">Prepared from {project.name} · Review all assumptions and [TBC] markers before approval.</p>{rows.map((section) => <section key={section.id}><h2>{section.title}</h2><MarkdownContent content={section.content}/></section>)}</article></main>;
}
