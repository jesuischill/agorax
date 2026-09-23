"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    createClient()
      .auth
      .getUser()
      .then(({ data }) => {
        router.replace(data.user ? "/feed" : "/login");
      });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
      Chargement d’AgoraX...
    </main>
  );
}
