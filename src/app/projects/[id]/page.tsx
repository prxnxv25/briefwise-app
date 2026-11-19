import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { ProjectWorkspace } from "@/components/project-workspace";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const [project] = await getDb().select({ id: projects.id }).from(projects).where(and(eq(projects.id, id), eq(projects.userId, session.user.id))).limit(1);
  if (!project) notFound();
  return <ProjectWorkspace projectId={id} name={session.user.name} email={session.user.email}/>;
}
