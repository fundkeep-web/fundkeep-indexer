# Indexer API Reference

[`fundkeep-indexer`](https://github.com/Michealshodipo56/fundkeep-indexer) polls the FundKeep contract's on-chain events into SQLite and serves them over a small REST API.

Base URL defaults to `http://localhost:4000`.

## Endpoints

### `GET /health`

Returns indexer health status and the latest processed ledger.

```json
{
  "ok": true,
  "lastLedger": 4625243
}
```

---

### `GET /api/goals/:owner`

Returns every goal owned by a given Stellar address.

```http
GET /api/goals/GAO5GK3F2XFVGUWKTFACJWRZVEGUWH47EJFLSAMLVRNP6CGV3YW2DDIK
```

**Response (200 OK):**
```json
{
  "goals": [
    {
      "goalId": 0,
      "owner": "GAO5GK3F2XFVGUWKTFACJWRZVEGUWH47EJFLSAMLVRNP6CGV3YW2DDIK",
      "token": "CCUWRYBOQTKMKTBLBJX5ZOZ2ZGCL7Z4ODNDB53DIPI4XMB4XBONY6G6X",
      "targetAmount": "100000000",
      "currentAmount": "40000000",
      "deadline": 1800000000,
      "status": "LOCKED",
      "createdAtLedger": 4620100,
      "updatedAtLedger": 4620550
    }
  ]
}
```

---

### `GET /api/goals/:owner/:goalId`

Returns a single indexed goal by its owner and goal ID. Supports direct deep-linking into goal details.

```http
GET /api/goals/GAO5GK3F2XFVGUWKTFACJWRZVEGUWH47EJFLSAMLVRNP6CGV3YW2DDIK/0
```

**Response (200 OK):**
```json
{
  "goalId": 0,
  "owner": "GAO5GK3F2XFVGUWKTFACJWRZVEGUWH47EJFLSAMLVRNP6CGV3YW2DDIK",
  "token": "CCUWRYBOQTKMKTBLBJX5ZOZ2ZGCL7Z4ODNDB53DIPI4XMB4XBONY6G6X",
  "targetAmount": "100000000",
  "currentAmount": "40000000",
  "deadline": 1800000000,
  "status": "LOCKED",
  "createdAtLedger": 4620100,
  "updatedAtLedger": 4620550
}
```

**Response (404 Not Found):**
```json
{
  "error": "Goal not found"
}
```

---

### `GET /api/activity/:owner`

Returns a chronological (newest-first) activity log for a given owner.

```http
GET /api/activity/GAO5GK3F2XFVGUWKTFACJWRZVEGUWH47EJFLSAMLVRNP6CGV3YW2DDIK?limit=50
```

| Query param | Default | Description |
|---|---|---|
| `limit` | 100 | Number of records to return (max 500) |
| `offset` | 0 | Pagination offset |

**Response (200 OK):**
```json
{
  "activity": [
    {
      "id": 42,
      "goalId": 0,
      "owner": "GAO5GK3F2XFVGUWKTFACJWRZVEGUWH47EJFLSAMLVRNP6CGV3YW2DDIK",
      "type": "deposit",
      "amount": "40000000",
      "ledger": 4620550,
      "txHash": "abc...",
      "createdAt": "2026-09-17T12:00:00.000Z"
    }
  ]
}
```
