import { requireOwner } from "@/lib/auth";
import Shell from "@/components/Shell";
import AdminClient from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireOwner();

  return (
    <Shell user={user}>
      <AdminClient
        currentUserId={user.id}
      />
    </Shell>
  );
}
