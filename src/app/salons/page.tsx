import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import SalonsClient from "@/components/SalonsClient";

export const dynamic = "force-dynamic";

async function getPageUser() {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") ?? "";
  const host = requestHeaders.get("host");

  if (!cookie || !host) {
    return null;
  }

  const forwardedProto =
    requestHeaders.get("x-forwarded-proto") || "https";

  try {
    const response = await fetch(
      `${forwardedProto}://${host}/api/me`,
      {
        headers: {
          cookie
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const user = data?.user ?? data;

    if (!user?.username) {
      return null;
    }

    return {
      username: String(user.username),
      role: user.role === "owner" ? ("owner" as const) : ("user" as const)
    };
  } catch {
    return null;
  }
}

export default async function SalonsPage() {
  const user = await getPageUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Shell user={user}>
      <SalonsClient />
    </Shell>
  );
}
