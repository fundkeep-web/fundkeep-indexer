import "dotenv/config";
import {
  Contract,
  Keypair,
  Networks,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { getOverdueLockedGoals, getGoal, type GoalRow } from "../src/db.js";

const RPC_URL = process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE ?? Networks.TESTNET;
const CONTRACT_ID = process.env.CONTRACT_ID;
const KEEPER_SECRET_KEY = process.env.KEEPER_SECRET_KEY;
const KEEPER_INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_MS ?? 30000);

if (!CONTRACT_ID) {
  console.error("[keeper] Error: CONTRACT_ID is required.");
  process.exit(1);
}

const server = new rpc.Server(RPC_URL, {
  allowHttp: RPC_URL.startsWith("http://"),
});

export async function processOverdueGoals(): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const overdueGoals: GoalRow[] = getOverdueLockedGoals(now);

  if (overdueGoals.length === 0) {
    console.log(`[keeper] No overdue locked goals found (current time: ${now}).`);
    return 0;
  }

  console.log(
    `[keeper] Found ${overdueGoals.length} overdue locked goal(s) requiring unlock.`
  );

  if (!KEEPER_SECRET_KEY) {
    console.warn(
      "[keeper] Warning: KEEPER_SECRET_KEY is not set. Running in dry-run inspection mode."
    );
    for (const goal of overdueGoals) {
      console.log(
        `[keeper] [DRY RUN] Overdue goal ID: ${goal.goal_id}, Owner: ${goal.owner}, Deadline: ${goal.deadline}, Current: ${goal.current_amount}`
      );
    }
    return overdueGoals.length;
  }

  const keeperKeypair = Keypair.fromSecret(KEEPER_SECRET_KEY);
  const keeperAccount = await server.getAccount(keeperKeypair.publicKey());
  const contract = new Contract(CONTRACT_ID);

  let processedCount = 0;

  for (const goal of overdueGoals) {
    try {
      console.log(`[keeper] Unlocking overdue goal ${goal.goal_id} for owner ${goal.owner}...`);

      const op = contract.call("check_deadline", xdr.ScVal.scvU32(goal.goal_id));
      const tx = new TransactionBuilder(keeperAccount, {
        fee: "100000",
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(op)
        .setTimeout(30)
        .build();

      const preparedTx = await server.prepareTransaction(tx);
      preparedTx.sign(keeperKeypair);

      const sendResponse = await server.sendTransaction(preparedTx);

      if (sendResponse.status === "ERROR") {
        console.error(
          `[keeper] Failed to submit check_deadline for goal ${goal.goal_id}:`,
          sendResponse.errorResult
        );
        continue;
      }

      console.log(
        `[keeper] check_deadline submitted for goal ${goal.goal_id}. TxHash: ${sendResponse.hash}. Waiting for confirmation...`
      );

      // Poll transaction status
      let getResponse = await server.getTransaction(sendResponse.hash);
      let attempts = 0;
      while (getResponse.status === "NOT_FOUND" && attempts < 10) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        getResponse = await server.getTransaction(sendResponse.hash);
        attempts++;
      }

      console.log(
        `[keeper] Goal ${goal.goal_id} unlock tx confirmed with status: ${getResponse.status}`
      );

      // Re-check after submission and log state
      const updatedGoal = getGoal(goal.goal_id);
      console.log(
        `[keeper] Updated goal ${goal.goal_id} state in DB:`,
        updatedGoal ? { unlocked: Boolean(updatedGoal.unlocked), withdrawn: Boolean(updatedGoal.withdrawn) } : "pending poller sync"
      );

      processedCount++;
    } catch (err) {
      console.error(`[keeper] Error processing goal ${goal.goal_id}:`, err);
    }
  }

  return processedCount;
}

// Check for once flag
const isOnce = process.argv.includes("--once");

if (isOnce) {
  processOverdueGoals()
    .then((count) => {
      console.log(`[keeper] Finished one-shot run. Processed ${count} goal(s).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[keeper] Fatal error:", err);
      process.exit(1);
    });
} else {
  console.log(
    `[keeper] Starting periodic keeper daemon. Polling every ${KEEPER_INTERVAL_MS}ms...`
  );
  setInterval(async () => {
    try {
      await processOverdueGoals();
    } catch (err) {
      console.error("[keeper] Scheduled tick error:", err);
    }
  }, KEEPER_INTERVAL_MS);

  // Initial tick
  processOverdueGoals().catch((err) => console.error("[keeper] Initial tick error:", err));
}
