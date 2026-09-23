"use client";

import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

function SettingsContent() {
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold">Réglages</h1>

      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <button
          onClick={logout}
          className="w-full rounded-2xl bg-red-500/15 px-4 py-3 text-left font-semibold text-red-300"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}
