import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Briefwise — BRD to project documents", description: "Read requirements, ask grounded questions, and create project documents from your brief." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
