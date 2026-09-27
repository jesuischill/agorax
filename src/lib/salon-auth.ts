import { NextRequest } from "next/server";

export type SalonUser = {
  id: string;
  username: string;
  role: "user" | "owner";
};

export async function getSalonUser(
  request: NextRequest
): Promise<SalonUser | null> {
  const cookie = request.headers.get("cookie") ?? "";

  if (!cookie) {
    return null;
  }

  try {
    const response = await fetch(
      new URL("/api/me", request.url),
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

    if (!user?.id) {
      return null;
    }

    return {
      id: String(user.id),
      username: String(
        user.username ??
        user.display_name ??
        user.name ??
        "Utilisateur"
      ),
      role: user.role === "owner" ? "owner" : "user"
    };
  } catch {
    return null;
  }
}
