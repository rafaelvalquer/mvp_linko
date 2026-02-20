// server/src/scripts/migratePlansAndQuota.js
import mongoose from "mongoose";
import { connectMongo } from "../config/mongo.js";
import { Workspace } from "../models/Workspace.js";
import { normalizePlan, limitForPlan, cycleKeySP } from "../utils/pixQuota.js";

async function run() {
  await connectMongo();

  const cursor = Workspace.find({}).cursor();

  let updated = 0;
  for await (const ws of cursor) {
    const plan = normalizePlan(ws.plan);

    const patch = {};
    let changed = false;

    // migração de plano (free->start, premium->pro)
    if (ws.plan !== plan) {
      patch.plan = plan;
      changed = true;
    }

    // limite
    if (plan !== "enterprise") {
      const should = limitForPlan(plan);
      const cur = Number(ws.pixMonthlyLimit);
      if (!Number.isFinite(cur) || cur <= 0 || cur !== should) {
        patch.pixMonthlyLimit = should;
        changed = true;
      }
    } else {
      // enterprise: mantém o que já tiver
      if (!Number.isFinite(Number(ws.pixMonthlyLimit))) {
        patch.pixMonthlyLimit = 0;
        changed = true;
      }
    }

    // pixUsage
    if (!ws.pixUsage || !ws.pixUsage.cycleKey) {
      patch["pixUsage.cycleKey"] = cycleKeySP(new Date());
      patch["pixUsage.used"] = 0;
      changed = true;
    } else if (ws.pixUsage.used == null) {
      patch["pixUsage.used"] = 0;
      changed = true;
    }

    // subscription default
    if (!ws.subscription || !ws.subscription.status) {
      patch["subscription.provider"] = "stripe";
      patch["subscription.status"] = "inactive";
      changed = true;
    }

    if (changed) {
      await Workspace.updateOne({ _id: ws._id }, { $set: patch });
      updated += 1;
    }
  }

  console.log(`[migrate] workspaces atualizados: ${updated}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
