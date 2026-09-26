import { requireUser } from "@/lib/auth";
import Shell from "@/components/Shell";
import ChatClient from "@/components/ChatClient";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await requireUser();

  return (
    <Shell user={user}>
      <ChatClient me={user.id}/>
    </Shell>
  );
}
