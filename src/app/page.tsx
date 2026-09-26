import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  redirect(user ? "/feed" : "/login");
}
