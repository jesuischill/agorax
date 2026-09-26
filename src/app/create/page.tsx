import { requireUser } from "@/lib/auth";
import Shell from "@/components/Shell";
import CreateClient from "@/components/CreateClient";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const user = await requireUser();

  return (
    <Shell user={user}>
      <CreateClient/>
    </Shell>
  );
}
