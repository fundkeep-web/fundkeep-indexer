import { config } from "./config.js";
import { decodeEvent, type DecodedEvent } from "./events.js";
import { rpcServer as server } from "./rpc.js";
import {
  applyDeposit,
  applyUnlock,
  applyWithdrawal,
  getGoal,
  getSyncState,
  insertActivity,
  insertGoal,
  setSyncState,
} from "./db.js";

function applyEvent(event: DecodedEvent): void {
  switch (event.kind) {
    case "goal_created":
      insertGoal({
        goalId: event.goalId,
        owner: event.owner,
        token: event.token,
        targetAmount: event.targetAmount,
        deadline: event.deadline,
        ledger: event.ledger,
      });
      insertActivity({
        goalId: event.goalId,
        owner: event.owner,
        type: "create",
        amount: null,
        ledger: event.ledger,
        txHash: event.txHash,
      });
      break;

    case "deposit": {
      applyDeposit({
        goalId: event.goalId,
        currentAmount: event.currentAmount,
        unlocked: event.unlocked,
        ledger: event.ledger,
      });
      const goal = getGoal(event.goalId);
      const owner = goal?.owner ?? event.caller;
      insertActivity({
        goalId: event.goalId,
        owner,
        type: "deposit",
        amount: event.amount,
        ledger: event.ledger,
        txHash: event.txHash,
      });
      if (event.unlocked) {
        insertActivity({
          goalId: event.goalId,
          owner,
          type: "unlock",
          amount: event.currentAmount,
          ledger: event.ledger,
          txHash: event.txHash,
        });
      }
      break;
    }

    case "unlock": {
      applyUnlock({ goalId: event.goalId, ledger: event.ledger });
      const goal = getGoal(event.goalId);
      if (goal) {
        insertActivity({
          goalId: event.goalId,
          owner: goal.owner,
          type: "unlock",
          amount: BigInt(goal.current_amount),
          ledger: event.ledger,
          txHash: event.txHash,
        });
      }
      break;
    }

    case "withdraw":
      applyWithdrawal({ goalId: event.goalId, ledger: event.ledger });
      insertActivity({
        goalId: event.goalId,
        owner: event.owner,
        type: "withdraw",
        amount: event.amount,
        ledger: event.ledger,
        txHash: event.txHash,
      });
      break;
  }
}

export async function pollOnce(): Promise<void> {
  const state = getSyncState();

  const request: rpc.Api.GetEventsRequest = state.cursor
    ? {
        filters: [{ type: "contract", contractIds: [config.contractId] }],
        cursor: state.cursor,
        limit: 100,
      }
    : {
        filters: [{ type: "contract", contractIds: [config.contractId] }],
        startLedger: await startingLedger(),
        limit: 100,
      };

  const res = await server.getEvents(request);

  for (const event of res.events) {
    const decoded = decodeEvent(event);
    if (decoded) applyEvent(decoded);
  }

  setSyncState(res.cursor, res.latestLedger);
}

async function startingLedger(): Promise<number> {
  const latest = await server.getLatestLedger();
  return Math.max(1, latest.sequence - config.eventsBackfillLedgers);
}

export function startPolling(): NodeJS.Timeout {
  const tick = () => {
    pollOnce().catch((err) => {
      console.error("[poller]", err instanceof Error ? err.message : err);
    });
  };
  tick();
  return setInterval(tick, config.pollIntervalMs);
}
