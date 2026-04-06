import { Boxes } from "lucide-react";
import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <header className="border-b border-slate-800 px-6 py-4">
        <Link href="/login" className="flex items-center gap-2 w-fit">
          <Boxes size={20} className="text-indigo-400" />
          <span className="text-white font-semibold">RJK Sandbox</span>
        </Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        {children}
      </main>
      <footer className="border-t border-slate-800 px-6 py-6 text-center text-sm text-slate-500">
        <Link href="/legal/eula" className="hover:text-slate-300 transition-colors">EULA</Link>
        <span className="mx-3">·</span>
        <Link href="/legal/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
      </footer>
    </div>
  );
}
