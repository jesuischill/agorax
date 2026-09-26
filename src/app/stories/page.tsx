import { requireUser } from "@/lib/auth";
import Shell from "@/components/Shell";
import StoriesClient from "@/components/StoriesClient";

export const dynamic = "force-dynamic";

export default async function StoriesPage() {
  const user = await requireUser();

  return (
    <Shell user={user}>
      <StoriesClient/>
    </Shell>
  );
}
