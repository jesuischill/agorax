import { requireUser } from "@/lib/auth";
import Shell from "@/components/Shell";
import DiscoverClient from "@/components/DiscoverClient";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const user = await requireUser();

  return (
    <Shell user={user}>
      <DiscoverClient/>
    </Shell>
  );
}
