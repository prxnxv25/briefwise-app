"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FilePlus2, FolderOpen, Plus, Sparkles, Trash2 } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";

type Project = { id: string; name: string; createdAt: string | Date; updatedAt: string | Date; sourceName: string | null };
export function DashboardClient({ name, email, initialProjects }: { name?: string | null; email?: string | null; initialProjects: Project[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  async function create(formData: FormData) {
    const projectName = String(formData.get("name") ?? "").trim();
    if (!projectName) return;
    setCreating(true); setError("");
    const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: projectName }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Could not create project."); setCreating(false); return; }
    router.push(`/projects/${result.project.id}`);
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this project and its generated documents?")) return;
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (response.ok) setProjects((current) => current.filter((project) => project.id !== id));
  }
  return <div className="app-shell"><AppTopbar name={name} email={email}/><main className="page-wrap"><div className="page-heading"><div><span className="welcome-tag"><Sparkles size={13}/> YOUR WORKSPACE</span><h1>Good to see you{name ? `, ${name.split(" ")[0]}` : ""}.</h1><p>Turn a business brief into project-ready documents.</p></div><button className="button button-primary" onClick={() => setOpen(true)}><Plus size={16}/> New project</button></div><div className="stats-strip"><div className="stat"><span className="stat-icon"><FolderOpen size={17}/></span><div><b>{projects.length}</b><small>Projects in your workspace</small></div></div><div className="stat"><span className="stat-icon"><FilePlus2 size={17}/></span><div><b>{projects.filter((project) => project.sourceName).length}</b><small>Briefs uploaded</small></div></div><div className="stat"><span className="stat-icon"><Sparkles size={17}/></span><div><b>3</b><small>Document types available</small></div></div></div><div className="section-title-row"><h2>Your projects</h2><span className="welcome-tag">Private to your account</span></div><div className="project-grid">{projects.length ? projects.map((project) => <article key={project.id} className="project-card"><div className="project-card-top"><span className="project-file-icon"><FilePlus2 size={20}/></span><span className="project-status">{project.sourceName ? "Brief uploaded" : "Set up in progress"}</span></div><a href={`/projects/${project.id}`}><h3>{project.name}</h3></a><p>{project.sourceName ?? "Upload a Word or PDF business brief to begin."}</p><div className="project-card-bottom"><span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span><div className="flex items-center gap-2"><button aria-label="Delete project" title="Delete project" className="text-slate-400 hover:text-red-600" onClick={() => remove(project.id)}><Trash2 size={14}/></button><a href={`/projects/${project.id}`} className="inline-flex items-center gap-1 text-teal-700 font-semibold">Open <ArrowRight size={13}/></a></div></div></article>) : <div className="empty-card"><div className="empty-icon"><FolderOpen size={21}/></div><h3>Your first project starts with a brief</h3><p>Create a project, add a Word or PDF BRD, and Briefwise will help you explore it and draft your project documents.</p><button className="button button-primary" onClick={() => setOpen(true)}><Plus size={15}/> Create your first project</button></div>}</div></main>{open && <div className="dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div className="dialog"><div className="eyebrow">NEW WORKSPACE</div><h2>Create a project</h2><p className="muted">Start with a name. You’ll upload the BRD in the next step.</p><form action={create}><label>Project name<input autoFocus name="name" placeholder="e.g. Customer onboarding platform" required maxLength={120}/></label>{error && <div className="form-error mt-3">{error}</div>}<div className="dialog-actions"><button type="button" className="button button-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button button-primary" disabled={creating}>{creating ? "Creating…" : "Create project"}<ArrowRight size={14}/></button></div></form></div></div>}</div>;
}
