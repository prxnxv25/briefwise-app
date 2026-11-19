import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { projects, sourceDocuments } from "@/db/schema";
import { DashboardClient } from "@/components/dashboard-client";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const rows = await getDb().select({ id: projects.id, name: projects.name, createdAt: projects.createdAt, updatedAt: projects.updatedAt, sourceName: sourceDocuments.originalName }).from(projects)
    .leftJoin(sourceDocuments, eq(sourceDocuments.projectId, projects.id)).where(eq(projects.userId, session.user.id)).orderBy(desc(projects.updatedAt));
  return <DashboardClient name={session.user.name} email={session.user.email} initialProjects={rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }))}/>;
}
