import { config } from "dotenv";

import { installLiveDbGuard } from "./live-db-guard";

// .env.local wins (Next.js convention), then .env; CI injects secrets directly.
config({ path: ".env.local" });
config();

// Tests share the production database: refuse any write to corpus_version.
installLiveDbGuard();

// In CI a missing secret must fail loudly, never silently skip everything.
if (process.env.CI && !process.env.DATABASE_URL) {
  throw new Error("CI run without DATABASE_URL — add the repo secret to the workflow");
}

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL not set — database integration tests will be SKIPPED. " +
      "Create .env or .env.local (see .env.example) to run them.",
  );
}
