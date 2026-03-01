# Security Self-Audit Checklist

## Access Control

- [x] Sensitive config (`oracle`, `jobId`, `fee`, endpoint) is owner-only.
- [x] Ownership initialized explicitly in constructor.

## Oracle Callback Safety

- [x] `fulfill` protected by `recordChainlinkFulfillment`.
- [x] Non-oracle addresses cannot spoof callback updates.

## Input Validation

- [x] Empty city is rejected.
- [x] Missing oracle/job config reverts.
- [x] Insufficient LINK reverts with explicit details.

## Data Integrity

- [x] Request metadata persisted by `requestId` and consumed in callback.
- [x] `WeatherReported` includes normalized fields for indexers.

## Gas and DoS Considerations

- [x] Parsing logic is linear on bounded payload assumptions.
- [x] No unbounded loops over dynamic storage arrays.

## Secrets & Configuration

- [x] API keys/private keys are environment-driven.
- [x] No secrets hardcoded in source files.

## Tests Coverage

- [x] Request flow (event + metadata + LINK checks)
- [x] Fulfillment flow (parsing + storage + event)
- [x] Access control restrictions
