import AppShell from "@/components/AppShell";

export default function NotificationsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-zinc-500">
          Les notifications sociales sont prêtes à être branchées sur la table
          notifications.
        </div>
      </div>
    </AppShell>
  );
}
