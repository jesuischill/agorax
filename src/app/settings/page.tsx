import { requireUser } from "@/lib/auth";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <Shell user={user}>
      <div className="container">
        <h1 className="page-title">
          Réglages
        </h1>

        <p className="subtitle">
          Ton compte AgoraX.
        </p>

        <section
          className="panel"
          style={{
            width:"min(100%,680px)",
            marginTop:18,
            padding:22
          }}
        >
          <div className="stack">
            <div>
              <div className="muted">
                Nom d’utilisateur
              </div>
              <strong>
                @{user.username}
              </strong>
            </div>

            <div>
              <div className="muted">
                Email
              </div>
              <strong>
                {user.email}
              </strong>
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
