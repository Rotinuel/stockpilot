#!/usr/bin/env bun
// Run scheduled jobs from a traditional crontab, e.g.:
//   0 * * * *  cd /srv/stockpilot && bun run cron all >> /var/log/stockpilot-cron.log 2>&1
import { runCron, CRON_TASKS } from "../services/cron.js";
import { disconnectDB } from "../lib/db.js";

const task = process.argv[2] || "all";
if (task !== "all" && !CRON_TASKS[task]) {
  console.error(`Unknown task "${task}". Available: all, ${Object.keys(CRON_TASKS).join(", ")}`);
  process.exit(1);
}

runCron(task)
  .then((results) => console.log(JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
