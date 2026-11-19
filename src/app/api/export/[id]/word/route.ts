import { and, asc, eq } from "drizzle-orm";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { generatedDocuments, projects, sections } from "@/db/schema";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  const [doc] = await db.select({ id: generatedDocuments.id, title: generatedDocuments.title, kind: generatedDocuments.kind }).from(generatedDocuments)
    .innerJoin(projects, eq(projects.id, generatedDocuments.projectId)).where(and(eq(generatedDocuments.id, id), eq(projects.userId, session.user.id))).limit(1);
  if (!doc) return new Response("Document not found", { status: 404 });
  const rows = await db.select().from(sections).where(and(eq(sections.documentId, id), eq(sections.isCurrent, true))).orderBy(asc(sections.createdAt));
  const children: (Paragraph | Table)[] = [new Paragraph({ text: `${doc.kind} · ${doc.title}`, heading: HeadingLevel.TITLE }), new Paragraph({ text: "Generated from a user-provided BRD. Verify assumptions and [TBC] items before approval.", style: "Subtitle" })];
  for (const section of rows) {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }));
    const lines = section.content.split("\n");
    for (let index = 0; index < lines.length;) {
      const trimmed = lines[index].trim();
      if (!trimmed) { index += 1; continue; }
      if (trimmed.startsWith("|")) {
        const tableLines: string[] = [];
        while (index < lines.length && lines[index].trim().startsWith("|")) tableLines.push(lines[index++]);
        const tableRows = tableLines.filter((line) => !/^\|?\s*:?-{3,}/.test(line.trim())).map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
        if (tableRows.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows.map((cells, rowIndex) => new TableRow({ children: cells.map((cell) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cell.replace(/\*\*/g, ""), bold: rowIndex === 0 })] })] })) })) }));
        continue;
      }
      const heading = trimmed.match(/^(#{1,4})\s+(.*)/);
      if (heading) children.push(new Paragraph({ text: heading[2], heading: heading[1].length > 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1 }));
      else children.push(new Paragraph({ children: [new TextRun(trimmed.replace(/^[-*]\s+/, "• ").replace(/\*\*/g, ""))], spacing: { after: 100 } }));
      index += 1;
    }
  }
  const output = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  return new Response(new Uint8Array(output), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${doc.kind}-${doc.title.replace(/[^a-z0-9-]/gi, "-").slice(0, 45)}.docx"` } });
}
