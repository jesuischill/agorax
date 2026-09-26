import { requireUser } from "@/lib/auth";
import Shell from "@/components/Shell";
import FeedClient from "@/components/FeedClient";

export const dynamic = "force-dynamic";

export default async function ReelsPage() {
  const user = await requireUser();

  return (
    <Shell user={user}>
      <FeedClient mode="reels"/>
    </Shell>
  );
}
