"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Camera,
  Compass,
  Home,
  LogOut,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/feed", label: "Accueil", icon: Home },
  { href: "/discover", label: "Découvrir", icon: Compass },
  { href: "/stories", label: "Stories", icon: Camera },
  { href: "/chat", label: "Messages", icon: MessageCircle },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profil", icon: UserRound },
];

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-zinc-950/95 p-5 lg:block">
        <Link href="/feed" className="mb-8 block">
          <span className="text-3xl font-black tracking-tight">
            Agora<span className="text-fuchsia-400">X</span>
          </span>
          <p className="mt-1 text-xs text-zinc-500">Le réseau qui te ressemble.</p>
        </Link>

        <nav className="space-y-2">
          {links.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                  active
                    ? "bg-white text-black"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="absolute bottom-6 left-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-zinc-400 hover:bg-white/5 hover:text-white"
        >
          <LogOut size={19} />
          Déconnexion
        </button>
      </aside>

      <main className="min-h-screen lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-8">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-white/10 bg-zinc-950/95 p-3 backdrop-blur lg:hidden">
        {links.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "text-white" : "text-zinc-500"}
            >
              <Icon size={22} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
