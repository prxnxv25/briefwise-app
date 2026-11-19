import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthForm } from "@/components/auth-form";
export default async function SignupPage() { if (await auth()) redirect("/projects"); return <AuthForm mode="signup" />; }
