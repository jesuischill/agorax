const Database = require("better-sqlite3");

const needle = (process.argv[2] || "").trim();

if (!needle) {
  console.error(
    "Usage: npm run admin:owner -- \"moha DZ\""
  );
  process.exit(1);
}

const db = new Database(
  "./data/agorax.db"
);

db.pragma("foreign_keys = ON");

const users = db
  .prepare(`
    SELECT
      id,
      username,
      display_name,
      role
    FROM users
    WHERE lower(username) = lower(?)
       OR lower(display_name) = lower(?)
  `)
  .all(
    needle,
    needle
  );

if (users.length === 0) {
  console.error(
    `❌ Aucun compte trouvé pour "${needle}".`
  );
  process.exit(1);
}

if (users.length > 1) {
  console.error(
    `❌ Plusieurs comptes correspondent à "${needle}".`
  );

  for (const user of users) {
    console.error(
      `- @${user.username} — ${user.display_name}`
    );
  }

  process.exit(1);
}

const user = users[0];

db.transaction(() => {
  db.prepare(`
    UPDATE users
    SET role = 'user'
    WHERE role = 'owner'
      AND id <> ?
  `).run(user.id);

  db.prepare(`
    UPDATE users
    SET role = 'owner',
        banned = 0
    WHERE id = ?
  `).run(user.id);
})();

console.log("");
console.log("✅ OWNER CONFIGURÉ");
console.log(`Compte : @${user.username}`);
console.log(`Nom : ${user.display_name}`);
console.log("Tous les autres comptes sont non-owner.");
console.log("");
console.log("Admin : http://localhost:3000/admin");
