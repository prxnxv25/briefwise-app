"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { ArrowDownToLine, ArrowLeft, Check, ChevronDown, CircleHelp, FileText, MessageCircle, MoreHorizontal, Pencil, RefreshCw, Send, Sparkles, TableProperties, Trash2, UploadCloud, WandSparkles, X } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { MarkdownContent } from "@/components/markdown-content";
import { outlines, type DocumentKind } from "@/lib/documents";

type Requirement = { id: string; type: string; text: string };
type Question = { id: string; question: string; suggestedDefault?: string; reason?: string };
type AnalysisData = { requirements?: Requirement[]; questions?: Question[]; scope?: { in?: string[]; out?: string[] }; stakeholders?: string[]; assumptions?: string[]; constraints?: string[]; risks?: string[]; [key: string]: unknown };
type SourceFile = { id: string; originalName: string; mimeType: string; createdAt: string };
type Generated = { id: string; kind: string; title: string; createdAt: string };
type DocSection = { id: string; documentId: string; sectionKey: string; title: string; content: string; version: number; isCurrent: boolean; createdAt: string };
type ProjectData = { project: { id: string; name: string }; source: SourceFile | null; analysis: { data: AnalysisData; answers: Record<string, string> } | null; documents: Generated[]; sections: DocSection[] };
type ChatMessage = { id: string; role: string; content: string; createdAt?: string; sourceReferences?: { label: string; content: string }[] };
type Tab = "Overview" | "Analyze BRD" | "Chat with BRD" | "Generate documents" | "Traceability";

const kindLabels: Record<DocumentKind, string> = { FSD: "Functional Specification", TSD: "Technical Specification", SPD: "Solution Proposal" };
const kindDescriptions: Record<DocumentKind, string> = { FSD: "User flows, business rules, and acceptance criteria.", TSD: "Architecture, data, APIs, security, and operations.", SPD: "Scope, delivery approach, risks, and success measures." };

export function ProjectWorkspace({ projectId, name, email }: { projectId: string; name?: string | null; email?: string | null }) {
  const [data, setData] = useState<ProjectData | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [tab, setTab] = useState<Tab>("Overview");
  const [kind, setKind] = useState<DocumentKind>("FSD");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [question, setQuestion] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (response.ok) {
      const result = await response.json() as ProjectData;
      setData(result); setAnswers(result.analysis?.answers ?? {});
    }
  }, [projectId]);
  const refreshChat = useCallback(async () => {
    const response = await fetch(`/api/chat/${projectId}`, { cache: "no-store" });
    if (response.ok) setChat((await response.json()).messages);
  }, [projectId]);
  useEffect(() => {
    void fetch(`/api/projects/${projectId}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as ProjectData;
      setData(result); setAnswers(result.analysis?.answers ?? {});
    });
    void fetch(`/api/chat/${projectId}`, { cache: "no-store" }).then(async (response) => {
      if (response.ok) setChat((await response.json()).messages);
    });
  }, [projectId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, chatBusy]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3400); };
  const currentDocs = data?.documents ?? [];
  const sectionsFor = (docId: string) => (data?.sections ?? []).filter((section) => section.documentId === docId);
  const currentSectionFor = (docId: string, key: string) => sectionsFor(docId).filter((section) => section.sectionKey === key && section.isCurrent).sort((a, b) => b.version - a.version)[0];
  const generatedDoc = currentDocs.find((document) => document.kind === kind);

  async function handleFile(file?: File) {
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (!ext || !["doc", "docx", "pdf"].includes(ext)) { setError("Unsupported file format. Choose a Word (.doc or .docx) or PDF file."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("This test app supports files up to 8 MB."); return; }
    if (!data) return;
    setError(""); setUploading(true); setProgress(0);
    try {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      await upload(`${projectId}/${safeFileName}`, file, {
        access: "private", handleUploadUrl: "/api/upload", contentType: file.type || (ext === "pdf" ? "application/pdf" : "application/msword"),
        clientPayload: JSON.stringify({ projectId, originalName: file.name, mimeType: file.type || "application/octet-stream" }),
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });
      let done = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        await refresh();
        const check = await fetch(`/api/projects/${projectId}`, { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<ProjectData> : null);
        if (check?.source?.originalName === file.name) { done = true; break; }
      }
      if (!done) throw new Error("The upload completed, but document extraction is still processing. Refresh in a moment.");
      setTab("Overview"); notify("Your document is uploaded and ready to analyze.");
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Upload failed."); }
    finally { setUploading(false); setProgress(0); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function analyze() {
    setAnalyzing(true); setError("");
    try {
      const response = await fetch(`/api/analyze/${projectId}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Analysis failed.");
      await refresh(); setTab("Analyze BRD"); notify("BRD analysis is ready for your review.");
    } catch (analysisError) { setError(analysisError instanceof Error ? analysisError.message : "Analysis failed."); }
    finally { setAnalyzing(false); }
  }

  async function saveAnswers(event: FormEvent) {
    event.preventDefault(); setSavingAnswers(true);
    try {
      const response = await fetch(`/api/analyze/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not save answers.");
      await refresh(); notify("Your answers were saved.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save answers."); }
    finally { setSavingAnswers(false); }
  }

  async function generateSection(sectionIndex: number): Promise<boolean> {
    setGenerating(true); setActiveSection(sectionIndex); setStreamingText(""); setError("");
    try {
      const response = await fetch(`/api/generate/${projectId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, sectionIndex }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? "Could not generate section."); }
      if (!response.body) throw new Error("The generation stream was unavailable.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let streamError = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n"); buffer = events.pop() ?? "";
        for (const event of events) {
          const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const parsed = JSON.parse(dataLine.slice(6)) as { text?: string; error?: string; reset?: boolean };
          if (parsed.reset) { setStreamingText(""); continue; }
          if (parsed.text) setStreamingText((previous) => previous + parsed.text);
          if (parsed.error) streamError = parsed.error;
        }
      }
      if (streamError) throw new Error(streamError);
      await refresh();
      return true;
    } catch (generationError) { setError(generationError instanceof Error ? generationError.message : "Generation failed."); return false; }
    finally { setGenerating(false); setActiveSection(null); setStreamingText(""); }
  }

  async function generateAll() {
    let completed = 0;
    for (let index = 0; index < outlines[kind].length; index += 1) {
      if (!await generateSection(index)) break;
      completed += 1;
    }
    notify(completed === outlines[kind].length ? `${kind} generation finished.` : `${kind} generation stopped after ${completed} section(s).`);
  }

  async function saveSection(section: DocSection) {
    const response = await fetch("/api/sections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: section.documentId, sectionKey: section.sectionKey, title: section.title, content: editText }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Could not save section."); return; }
    setEditingId(null); await refresh(); notify("Section saved as a new version.");
  }

  async function restoreVersion(sectionId: string) {
    const response = await fetch("/api/sections/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionId }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Could not restore version."); return; }
    await refresh(); notify("Earlier version restored as a new version.");
  }

  async function sendQuestion(event: FormEvent) {
    event.preventDefault(); const text = question.trim(); if (!text || chatBusy) return;
    setQuestion(""); setChat((current) => [...current, { id: `local-${Date.now()}`, role: "user", content: text }]); setChatBusy(true); setError("");
    try {
      const response = await fetch(`/api/chat/${projectId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Chat failed.");
      setChat((current) => [...current.filter((message) => !message.id.startsWith("local-")), result.message]);
    } catch (chatError) { setError(chatError instanceof Error ? chatError.message : "Chat failed."); await refreshChat(); }
    finally { setChatBusy(false); }
  }

  async function deleteSource() {
    if (!data?.source || !window.confirm("Delete the uploaded BRD and its analysis and generated drafts from this project?")) return;
    const response = await fetch(`/api/documents/${data.source.id}`, { method: "DELETE" });
    if (response.ok) { await refresh(); await refreshChat(); notify("Source document deleted."); } else setError("Could not delete source document.");
  }

  if (!data) return <div className="app-shell"><AppTopbar name={name} email={email}/><div className="loading-line"><span className="spinner"/> Loading project…</div></div>;
  const analysisData = data.analysis?.data;
  const requirements = analysisData?.requirements ?? [];
  const documentIds = new Set(currentDocs.map((doc) => doc.id));
  const allCurrentSections = data.sections.filter((section) => section.isCurrent && documentIds.has(section.documentId));
  const validIds = new Set(requirements.map((requirement) => requirement.id));
  const citedByKind = new Map<string, Set<string>>();
  for (const doc of currentDocs) citedByKind.set(doc.kind, new Set(allCurrentSections.filter((section) => section.documentId === doc.id).flatMap((section) => section.content.match(/\[(?:FR|NFR|CON)-\d{3}\]/g) ?? []).map((id) => id.slice(1, -1))));
  const citationsInOutput = new Set(allCurrentSections.flatMap((section) => section.content.match(/\[(?:FR|NFR|CON)-\d{3}\]/g) ?? []).map((id) => id.slice(1, -1)));
  const invalidCitations = [...citationsInOutput].filter((id) => !validIds.has(id));

  return <div className="app-shell"><AppTopbar name={name} email={email}/><main className="page-wrap"><div className="workspace-top"><Link className="back-link" href="/projects"><ArrowLeft size={14}/> All projects</Link><span className="topbar-divider"/><span className="topbar-caption">Project workspace</span></div><div className="workspace-heading"><div><span className="eyebrow">BRD PROJECT</span><h1>{data.project.name}</h1><p>{data.source ? `Source document · ${data.source.originalName}` : "Upload a Word or PDF business requirements document to get started."}</p></div><div className="workspace-actions">{generatedDoc && <><a className="button button-secondary button-small" href={`/api/export/${generatedDoc.id}/word`}><ArrowDownToLine size={14}/> Word</a><a className="button button-secondary button-small" target="_blank" href={`/projects/${projectId}/print?doc=${generatedDoc.id}`}><FileText size={14}/> PDF / print</a></>}</div></div>
    <nav className="tabs">{(["Overview", "Analyze BRD", "Chat with BRD", "Generate documents", "Traceability"] as Tab[]).map((item) => <button key={item} className={`tab ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>{item === "Chat with BRD" ? <span className="inline-flex items-center gap-2"><MessageCircle size={14}/>{item}</span> : item}</button>)}</nav>
    {error && <div className="notice notice-warn mb-4"><CircleHelp size={15}/><span>{error}</span><button className="ml-auto" aria-label="Dismiss" onClick={() => setError("")}><X size={14}/></button></div>}

    {tab === "Overview" && <div className="workspace-grid"><div><section className="panel"><div className="panel-head"><div><h2>Business requirements document</h2><p>Upload the source file you want to understand and use for generation.</p></div>{data.source && <button title="Delete source" className="button button-secondary button-small" onClick={deleteSource}><Trash2 size={13}/> Delete</button>}</div>{data.source ? <div className="file-pill"><span className="file-pill-icon"><FileText size={18}/></span><div className="flex-1"><b>{data.source.originalName}</b><small>Private to your account · {new Date(data.source.createdAt).toLocaleString()}</small></div><Check size={16} className="text-emerald-600"/></div> : <div className="upload-zone"><div className="upload-icon"><UploadCloud size={19}/></div><h3>Drop your BRD here, or browse files</h3><p>Word (.doc, .docx) or text-based PDF · Up to 8 MB</p><input ref={fileRef} className="hidden" type="file" accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => void handleFile(event.target.files?.[0])}/><button className="button button-secondary button-small" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "Uploading…" : "Choose a file"}</button>{uploading && <div className="progress-track"><span style={{ width: `${progress}%` }}/></div>}</div>}{!data.source && <div className="mt-3 text-[10px] text-slate-400">Other file formats are rejected. Scanned PDFs without selectable text are not OCR-processed in this test version.</div>}</section>
      <section className="panel"><div className="panel-head"><div><h2>Suggested workflow</h2><p>Review the source before asking the model to draft project documents.</p></div><Sparkles size={18} className="text-teal-700"/></div><div className="steps-list"><div className="step-row"><span className="step-number">1</span><div><b>Analyze the BRD</b><small>Extract requirements and surface gaps. Review questions and assumptions before generation.</small></div></div><div className="step-row"><span className="step-number">2</span><div><b>Explore the source</b><small>Ask questions in a retrieval-grounded chat. Answers cite BRD excerpts.</small></div></div><div className="step-row"><span className="step-number">3</span><div><b>Generate the documents</b><small>Create FSD, TSD, or SPD one section at a time and keep each revision.</small></div></div></div></section></div>
      <aside><section className="panel"><div className="panel-head"><div><h2>Project readiness</h2><p>Complete these steps to start drafting.</p></div></div><div className="steps-list"><div className="step-row"><span className="step-number">{data.source ? <Check size={12}/> : "1"}</span><div><b>Upload source document</b><small>{data.source ? "Your BRD is stored privately." : "Required to analyze and generate."}</small></div></div><div className="step-row"><span className="step-number">{data.analysis ? <Check size={12}/> : "2"}</span><div><b>Analyze and review</b><small>{data.analysis ? `${requirements.length} requirements extracted.` : "Identify requirements and answer open questions."}</small></div></div><div className="step-row"><span className="step-number">{currentDocs.length ? <Check size={12}/> : "3"}</span><div><b>Generate a document</b><small>{currentDocs.length ? `${currentDocs.length} document type(s) started.` : "Choose FSD, TSD, or SPD."}</small></div></div></div>{data.source && <button className="button button-primary w-full mt-4" disabled={analyzing} onClick={() => data.analysis ? setTab("Analyze BRD") : void analyze()}>{analyzing ? <><span className="spinner"/> Analyzing brief…</> : data.analysis ? "Review BRD analysis" : <><WandSparkles size={15}/> Analyze BRD</>}</button>}</section><section className="panel"><div className="panel-head"><div><h2>Your output formats</h2><p>Export each generated document.</p></div></div><div className="flex items-center gap-2 text-[11px] text-slate-600"><FileText size={15} className="text-teal-700"/> Word document (.docx)</div><div className="flex items-center gap-2 mt-3 text-[11px] text-slate-600"><FileText size={15} className="text-teal-700"/> PDF via print / save as PDF</div></section></aside></div>}

    {tab === "Analyze BRD" && <div className="workspace-grid"><div><section className="panel"><div className="panel-head"><div><h2>BRD analysis</h2><p>Requirements and context extracted from {data.source?.originalName ?? "your source file"}.</p></div><button className="button button-secondary button-small" onClick={() => void analyze()} disabled={!data.source || analyzing}><RefreshCw size={13} className={analyzing ? "animate-spin" : ""}/> {analyzing ? "Analyzing…" : "Re-analyze"}</button></div>{!analysisData ? <div className="empty-card"><div className="empty-icon"><WandSparkles size={19}/></div><h3>No analysis yet</h3><p>Analyze the BRD to extract traceable requirements, stakeholders, assumptions, risks, and open questions.</p><button className="button button-primary" disabled={!data.source || analyzing} onClick={() => void analyze()}>{analyzing ? "Analyzing…" : "Analyze BRD"}</button></div> : <><h3 className="text-xs font-bold mb-3">Requirements <span className="text-slate-400 font-normal">({requirements.length})</span></h3>{requirements.length ? <div className="requirement-list">{requirements.map((item) => <div key={item.id} className="requirement-row"><span className="req-id">{item.id}</span><span className="req-kind">{item.type}</span><span>{item.text}</span></div>)}</div> : <div className="notice">No explicit requirements were found. Use the chat to explore the source.</div>}<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6"><div><h3 className="text-xs font-bold mb-2">Scope</h3><div className="notice">{analysisData.scope?.in?.length ? <ul className="list-disc pl-4">{analysisData.scope.in.map((value, index) => <li key={index}>{value}</li>)}</ul> : "[TBC]"}</div><h3 className="text-xs font-bold mt-4 mb-2">Stakeholders</h3><div className="notice">{analysisData.stakeholders?.length ? analysisData.stakeholders.join(" · ") : "[TBC]"}</div></div><div><h3 className="text-xs font-bold mb-2">Risks and constraints</h3><div className="notice">{[...(analysisData.risks ?? []), ...(analysisData.constraints ?? [])].length ? <ul className="list-disc pl-4">{[...(analysisData.risks ?? []), ...(analysisData.constraints ?? [])].map((value, index) => <li key={index}>{value}</li>)}</ul> : "[TBC]"}</div><h3 className="text-xs font-bold mt-4 mb-2">Assumptions</h3><div className="notice">{analysisData.assumptions?.length ? analysisData.assumptions.join(" · ") : "No assumptions identified."}</div></div></div></>}</section></div><aside><section className="panel"><div className="panel-head"><div><h2>Open questions</h2><p>Your answers guide document generation. Leave blank to use a marked assumption.</p></div></div>{analysisData ? <form onSubmit={(event) => void saveAnswers(event)}>{(analysisData.questions ?? []).length ? (analysisData.questions ?? []).map((item) => <div className="question-card" key={item.id}><p><b>{item.id}</b> · {item.question}</p><label>Your answer<textarea className="answer-input" value={answers[item.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={item.suggestedDefault ? `Suggested default: ${item.suggestedDefault}` : "Add your answer, or leave blank"}/></label>{item.suggestedDefault && <div className="question-default">Suggested: {item.suggestedDefault}</div>}</div>) : <div className="notice">No open questions were identified.</div>}<button className="button button-primary w-full mt-4" disabled={savingAnswers}>{savingAnswers ? "Saving…" : "Save answers"}</button></form> : <div className="notice">Run an analysis to see open questions.</div>}</section></aside></div>}

    {tab === "Chat with BRD" && <div className="workspace-grid"><section className="panel chat-card"><div className="panel-head"><div><h2>Chat with your BRD</h2><p>Answers are grounded in retrieved passages from your uploaded file.</p></div><span className="welcome-tag"><Sparkles size={12}/> RAG CHAT</span></div><div className="chat-history">{chat.length ? chat.map((message) => <div key={message.id} className={`chat-bubble ${message.role === "user" ? "user" : "assistant"}`}><div>{message.content}</div>{message.role === "assistant" && message.sourceReferences?.length ? <details className="chat-sources"><summary>View {message.sourceReferences.length} cited BRD passage(s)</summary>{message.sourceReferences.map((source, index) => <div key={index} className="chat-source"><b>{source.label}</b><p>{source.content}</p></div>)}</details> : null}</div>) : <div className="chat-empty"><div className="chat-empty-icon"><MessageCircle size={22}/></div><b>Ask something about the brief</b><p>For example: “What are the main user roles?” or “Which decisions are still unclear?”</p></div>}{chatBusy && <div className="chat-bubble assistant"><span className="inline-flex items-center gap-2"><span className="spinner"/> Searching the brief and composing an answer…</span></div>}<div ref={chatEndRef}/></div><form className="chat-input-row" onSubmit={(event) => void sendQuestion(event)}><textarea className="chat-input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={data.source ? "Ask a question about this document…" : "Upload a BRD before chatting"} disabled={!data.source || chatBusy} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/><button className="button button-primary chat-send" disabled={!question.trim() || chatBusy || !data.source}><Send size={15}/></button></form></section><aside><section className="panel"><h2>How answers are grounded</h2><p className="muted text-[11px]">The app retrieves the most relevant text passages from your uploaded document and gives those passages to MiniMax with your question. The model is instructed to cite its sources and say when the document does not contain an answer.</p><div className="notice mt-3">This test build uses lexical retrieval (matching terms in the document) and does not use a separate paid embeddings API.</div></section>{data.source && <section className="panel"><h2>Source document</h2><div className="file-pill mt-3"><FileText size={16} className="file-pill-icon"/><div><b>{data.source.originalName}</b><small>Private upload</small></div></div></section>}</aside></div>}

    {tab === "Generate documents" && <div className="workspace-grid"><div><section className="panel"><div className="panel-head"><div><h2>Choose a document</h2><p>Each section is generated independently and saved as a new version when revised.</p></div></div><div className="doc-type-grid">{(Object.keys(outlines) as DocumentKind[]).map((docKind) => <button key={docKind} className={`doc-type-card ${kind === docKind ? "selected" : ""}`} onClick={() => setKind(docKind)}><span className="doc-code">{docKind}</span><b>{kindLabels[docKind]}</b><small>{kindDescriptions[docKind]}</small></button>)}</div>{!data.analysis && <div className="notice notice-warn mt-4"><CircleHelp size={14}/> Analyze the BRD and review open questions before generating a document.</div>}<div className="section-title-row"><h2>{kind} outline</h2><button className="button button-primary button-small" disabled={generating || !data.analysis} onClick={() => void generateAll()}><Sparkles size={13}/>{generating ? "Generating…" : "Generate full document"}</button></div><div className="outline-list">{outlines[kind].map((title, index) => { const section = generatedDoc ? currentSectionFor(generatedDoc.id, `${kind}-${index}`) : undefined; return <div key={title} className={`outline-row ${section ? "done" : ""}`}><span className="outline-num">{section ? <Check size={12}/> : String(index + 1).padStart(2, "0")}</span><span>{title}</span>{generating && activeSection === index ? <span className="inline-flex items-center gap-2 text-teal-700 text-[10px]"><span className="spinner"/> Writing</span> : <button disabled={generating || !data.analysis} onClick={() => void generateSection(index)}>{section ? <span className="inline-flex items-center gap-1"><RefreshCw size={11}/> Regenerate</span> : "Generate"}</button>}</div>; })}</div>{generating && <div className="doc-output"><div className="doc-output-head"><b>{outlines[kind][activeSection ?? 0]}</b><small>Streaming from MiniMax…</small></div><div className="doc-section"><div className="doc-section-content"><MarkdownContent content={streamingText || "Preparing section…"}/></div></div></div>}</section>
      {generatedDoc && <section className="panel"><div className="panel-head"><div><h2>{kind} document</h2><p>Review, edit, regenerate, or restore an earlier section version.</p></div><span className="welcome-tag">{allCurrentSections.filter((section) => section.documentId === generatedDoc.id).length} / {outlines[kind].length} sections</span></div><div className="doc-output"><div className="doc-output-head"><b>{generatedDoc.title}</b><small>Versioned as you save</small></div>{outlines[kind].map((title, index) => { const key = `${kind}-${index}`; const current = currentSectionFor(generatedDoc.id, key); const versions = sectionsFor(generatedDoc.id).filter((section) => section.sectionKey === key).sort((a, b) => b.version - a.version); if (!current) return null; return <div className="doc-section" key={key}><div className="doc-section-head"><div><h3>{title}</h3><small className="text-[10px] text-slate-400">Version {current.version}</small></div><div className="flex items-center gap-2"><button className="button button-secondary button-small" onClick={() => { setEditingId(editingId === current.id ? null : current.id); setEditText(current.content); }}><Pencil size={11}/> Edit</button><button className="button button-secondary button-small" onClick={() => setExpandedHistory(expandedHistory === key ? null : key)}><MoreHorizontal size={13}/> History <ChevronDown size={11}/></button></div></div>{editingId === current.id ? <><textarea className="editor-input" value={editText} onChange={(event) => setEditText(event.target.value)}/><div className="flex justify-end gap-2 mt-2"><button className="button button-secondary button-small" onClick={() => setEditingId(null)}>Cancel</button><button className="button button-primary button-small" onClick={() => void saveSection(current)}><Check size={12}/> Save version</button></div></> : <MarkdownContent content={current.content}/ >}{expandedHistory === key && <div className="mt-3 border-t pt-2">{versions.map((version) => <div key={version.id} className="flex items-center justify-between py-1.5 text-[10px] text-slate-500"><span>Version {version.version} · {new Date(version.createdAt).toLocaleString()}{version.isCurrent ? " · Current" : ""}</span>{!version.isCurrent && <button className="text-teal-700 font-bold" onClick={() => void restoreVersion(version.id)}>Restore</button>}</div>)}</div>}</div>; })}</div></section>}</div><aside><section className="panel"><div className="panel-head"><div><h2>Exports</h2><p>Exports are available once you have generated at least one section.</p></div></div>{generatedDoc ? <div className="steps-list"><a className="button button-secondary justify-start" href={`/api/export/${generatedDoc.id}/word`}><ArrowDownToLine size={15}/> Download Word (.docx)</a><a className="button button-secondary justify-start" target="_blank" href={`/projects/${projectId}/print?doc=${generatedDoc.id}`}><FileText size={15}/> Print / save as PDF</a></div> : <div className="notice">Generate a section to enable exports.</div>}</section><section className="panel"><h2>Quality rules</h2><div className="steps-list mt-3"><div className="step-row"><span className="step-number"><Check size={11}/></span><div><b>Evidence-led</b><small>Sections cite requirement IDs and use [TBC] for missing details.</small></div></div><div className="step-row"><span className="step-number"><Check size={11}/></span><div><b>Assumptions are visible</b><small>Unanswered open questions are marked “Assumed.”</small></div></div><div className="step-row"><span className="step-number"><Check size={11}/></span><div><b>Human reviewed</b><small>Every section is editable and versioned.</small></div></div></div></section></aside></div>}

    {tab === "Traceability" && <section className="panel"><div className="panel-head"><div><h2>Requirement traceability</h2><p>Coverage compares the IDs in current document sections with IDs from the BRD analysis.</p></div><TableProperties size={18} className="text-teal-700"/></div>{!data.analysis ? <div className="notice">Analyze your BRD first to create the requirement register.</div> : <>{invalidCitations.length > 0 && <div className="notice notice-warn mb-4"><CircleHelp size={14}/> IDs not present in the analysis: {invalidCitations.join(", ")}</div>}{requirements.length ? <div>{requirements.map((requirement) => <div className="trace-row" key={requirement.id}><div className="trace-row-top"><b><span className="req-id mr-2">{requirement.id}</span>{requirement.text}</b><span className="text-[10px] text-slate-400">{requirement.type}</span></div><div className="trace-pills mt-2">{(Object.keys(outlines) as DocumentKind[]).map((docKind) => { const cites = citedByKind.get(docKind)?.has(requirement.id) ?? false; return <span key={docKind} className={`trace-pill ${cites ? "" : currentDocs.some((doc) => doc.kind === docKind) ? "uncovered" : "uncovered"}`}>{docKind} · {cites ? "Cited" : "Uncovered"}</span>; })}</div></div>)}</div> : <div className="notice">No requirements were identified in the analysis.</div>}</>}</section>}
    </main>{toast && <div className="toast">{toast}</div>}</div>;
}

