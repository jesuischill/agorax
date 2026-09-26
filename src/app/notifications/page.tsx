import { requireUser } from "@/lib/auth";
import Shell from "@/components/Shell";
import NotificationsClient from "@/components/NotificationsClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();

  return (
    <Shell user={user}>
      <NotificationsClient/>
    </Shell>
  );
}
