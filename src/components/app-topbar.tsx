"use client";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { FileText, LogOut } from "lucide-react";
export function AppTopbar({ name, email }: { name?: string | null; email?: string | null }) {
  return <header className="topbar"><div className="topbar-left"><Link href="/projects" className="brand-mark"><span className="brand-icon"><FileText size={18}/></span>briefwise</Link><span className="topbar-divider"/><span className="topbar-caption">Project document studio</span></div><div className="topbar-right"><div className="user-chip"><span>{email}</span><span className="avatar">{(name?.[0] ?? email?.[0] ?? "U").toUpperCase()}</span></div><button className="button button-secondary button-small" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut size={14}/> Sign out</button></div></header>;
}
