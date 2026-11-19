"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, LockKeyhole } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(formData: FormData) {
    setBusy(true); setError("");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    if (mode === "signup") {
      const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formData.get("name"), email, password }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Unable to create account."); setBusy(false); return; }
    }
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) { setError("Email and password did not match."); setBusy(false); return; }
    router.push("/projects");
  }
  return <main className="auth-page"><section className="auth-brand"><Link href="/" className="brand-mark"><span className="brand-icon"><FileText size={20} /></span> briefwise</Link><div className="auth-pitch"><div className="eyebrow">BRD → PROJECT DOCUMENTS</div><h1>Turn the brief into a plan everyone can work from.</h1><p>Ask questions about your source document, then create a clear FSD, TSD, or solution proposal.</p><div className="auth-mini-cards"><div><span>01</span><b>Understand</b><small>Requirements, gaps, and risks</small></div><div><span>02</span><b>Generate</b><small>One grounded section at a time</small></div></div></div><div className="auth-legal">Private project workspaces · Powered by your Groq API key</div></section><section className="auth-panel"><div className="auth-box"><div className="auth-lock"><LockKeyhole size={18} /></div><div className="eyebrow">YOUR WORKSPACE</div><h2>{mode === "login" ? "Welcome back" : "Create your test account"}</h2><p className="muted">{mode === "login" ? "Sign in to continue to your projects." : "Use any test email and a password with at least 8 characters."}</p><form action={submit} className="auth-form">{mode === "signup" && <label>Name<input name="name" type="text" autoComplete="name" placeholder="Your name" required maxLength={80} /></label>}<label>Email<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label><label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" required minLength={8} /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight size={16} /></button></form><p className="auth-switch">{mode === "login" ? "New to Briefwise?" : "Already have an account?"} <Link href={mode === "login" ? "/signup" : "/login"}>{mode === "login" ? "Create an account" : "Sign in"}</Link></p></div></section></main>;
}
