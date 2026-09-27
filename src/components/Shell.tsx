"use client";

import Link from "next/link";
import { usePathname,useRouter } from "next/navigation";
import {
  Bell,
  Compass,
  Film,
  Home,
  LogOut,
  MessageCircle,
  PlusCircle,
  Settings,
  UserRound,
  Camera,
  Shield,
  Hash
} from "lucide-react";

const links = [
  ["/feed","Accueil",Home],
  ["/discover","Découvrir",Compass],
  ["/reels","Reels",Film],
  ["/stories","Stories",Camera],
  ["/messages","Messages",MessageCircle],
  ["/salons","Salons",Hash],
  ["/notifications","Notifications",Bell],
  ["/profile","Profil",UserRound],
  ["/create","Créer",PlusCircle],
  ["/settings","Réglages",Settings]
] as const;

export default function Shell({
  children,
  user
}: {
  children: React.ReactNode;
  user: {
    username: string;
    role: "user" | "owner";
  };
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch(
      "/api/auth/logout",
      { method: "POST" }
    );

    router.replace("/login");
    router.refresh();
  }

  function active(href:string) {
    return (
      pathname === href ||
      pathname.startsWith(href + "/")
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link
          href="/feed"
          className="brand"
        >
          Ago<span>raX</span>
        </Link>

        <nav className="nav">
          {links.map(
            ([href,label,Icon]) => (
              <Link
                key={href}
                href={href}
                className={
                  active(href)
                    ? "active"
                    : ""
                }
              >
                <Icon size={19}/>
                {label}
              </Link>
            )
          )}
        </nav>

        {user.role === "owner" && (
          <Link
            href="/admin"
            className={
              active("/admin")
                ? "active"
                : ""
            }
          >
            <Shield size={19}/>
            Admin
          </Link>
        )}

        <button
          className="logout"
          onClick={logout}
        >
          <LogOut size={19}/>
          Déconnexion
        </button>

        <div
          className="muted"
          style={{marginTop:20}}
        >
          @{user.username}
        </div>
      </aside>

      <main className="content">
        {children}
      </main>

      <nav className="mobile-nav">
        {[
          ["/feed",Home],
          ["/discover",Compass],
          ["/create",PlusCircle],
          ["/reels",Film],
          ["/profile",UserRound]
        ].map(
          ([href,Icon]) => (
            <Link
              key={String(href)}
              href={String(href)}
              className={
                active(String(href))
                  ? "active"
                  : ""
              }
            >
              <Icon size={21}/>
            </Link>
          )
        )}
      </nav>
    </div>
  );
}
