# Sharibo Client SDK

This package provides a TypeScript SDK for interacting with the Sharibo contract on Stellar/Soroban.

> [!NOTE]
> The package is consumed as built output from the `dist/` directory, not from source. Consumers (like the `app/` workspace) must build this package before running, usually via `npm run build --workspace=packages/client`.

The primary interface is **`ShariboSDK`** — a facade that binds a network, a signer, and a retry policy once, so callers never have to thread a raw contract client through their code (see `docs/adr/003-client-boundary.md`).

## 1. Connecting

`ShariboSDK.connect` initializes a connected client.

```ts
import { ShariboSDK } from "@sharibo/client";
import { Keypair } from "@stellar/stellar-sdk";

const sdk = await ShariboSDK.connect(
  {
    contractId: "CB64...",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  Keypair.random(),
  { retryPolicy: { maxRetries: 3, baseDelayMs: 500 } }
);
```

## 2. Creating a Circle

Circles hold shared funds. You can create one by providing a token and initial configuration.

```ts
const { result: circleId, hash } = await sdk.createCircle({
  admin: sdk.publicKey,
  token: "CDLZ...",
  root: treeRoot,
  contribution: 10_000_000n,
  size: 5,
  vk, // verification key
});
```

## 3. Funding

Participants fund a circle before it can be claimed.

```ts
await sdk.fund({ circleId, from: memberPublicKey });
```

## 4. Generating a Proof

Proof generation runs locally. It does not require a connected SDK, only the free functions.

```ts
import { generateIdentity, MerkleTree, generateProof, computeExternalNullifier } from "@sharibo/client";

const identity = generateIdentity();
const tree = MerkleTree.create(4, commitments);
const externalNullifier = await computeExternalNullifier(circleId, 0n);
const { proof, nullifierHash } = await generateProof(input, wasmPath, zkeyPath);
```

## 5. Claiming

Submit the locally generated proof to the contract to claim the pot.

```ts
const { hash, feeCharged } = await sdk.claim({
  circleId,
  recipient: freshRecipient,
  nullifierHash,
  externalNullifier,
  proof,
});
```

## 6. Reading State

You can inspect the state of a circle or check if a claim has already occurred.

```ts
const circle = await sdk.getCircle(circleId);
const alreadyClaimed = await sdk.hasClaimed(circleId, nullifierHash);
const pot = await sdk.getPot(circleId);
```

## 7. Handling Errors

The SDK provides specific typed errors for contract rejections (e.g., `AlreadyClaimedError`, `InvalidProofError`).
For a full list of errors and what they mean, see [docs/errors.md](../../docs/errors.md).

```ts
import { AlreadyClaimedError, ContractError } from "@sharibo/client";

try {
  await sdk.claim({ ... });
} catch (error) {
  if (error instanceof AlreadyClaimedError) {
    console.error("Nullifier was already seen by the contract.");
  } else if (error instanceof ContractError) {
    console.error("General contract failure:", error.message);
  }
}
```

## 8. Amounts and Addresses

Stellar amounts are handled in Stroops (1 XLM = 10,000,000 Stroops) using `bigint`.

```ts
import { formatXlm, xlmToStroops, stroopsToXlm } from "@sharibo/client";

const amount = xlmToStroops(1.5); // 15000000n
console.log(formatXlm(amount));   // "1.5"
```

## 9. Retries and Observability

Network requests in the Soroban testnet environment can occasionally fail. The SDK handles transient retries automatically. 

```ts
import { POLL_RETRY_POLICY } from "@sharibo/client";

// Override policy for a specific call:
const circle = await sdk.getCircle(circleId, POLL_RETRY_POLICY);
```

To monitor activity (useful for loading spinners), pass an `onEvent` callback when connecting or generating proofs. See [docs/observability.md](../../docs/observability.md) for a full event list.

```ts
const sdk = await ShariboSDK.connect(config, signer, {
  onEvent: (event) => console.log("SDK Event:", event.type),
});
```

## Internal subpath

`@sharibo/client/internal` exposes non-public helpers for deep integration work (like `FR_MODULUS` or the artifact prefetch machinery). It imports nothing eagerly into the main entrypoint. Importing from it is an explicit opt-in for internal use cases only.

## Node vs browser entry points

The package ships a conditional `exports` map:
- `browser`: Resolves to `src/index.browser.ts`, which includes background artifact pre-fetching logic.
- `default` (Node, tests): Resolves to `src/index.ts`, free of side effects and safe for scripts/tests.

---

## Public API

The public surface is small and explicit. `index.ts` re-exports exactly the values and types below, and a test (`src/index.test.ts`) asserts that this list and the barrel agree in both directions.

### Values

```ts
AlreadyClaimedError
CircleCancelledError
CircleNotFoundError
ContractError
DEFAULT_RETRY_POLICY
EXPLORER_NETWORKS
InvalidInputError
InvalidProofError
MAX_CIRCLE_SIZE
MerkleTree
NETWORKS
OverflowError
PATIENT_RETRY_POLICY
POLL_RETRY_POLICY
ProvingError
RoundFullError
RoundNotFundedError
RpcError
STROOPS_PER_XLM
SdkEventEmitter
ShariboError
ShariboSDK
TREE_LEVELS
WrongRoundTagError
ZERO_VALUE
cancelCircle
claim
clearContractClientCache
computeDelay
computeExternalNullifier
computeNullifierHash
computeRecipientHash
connect
connectReadOnly
createCircle
decodeContractError
describeContractError
describeError
encodeG1
encodeG2
estimateClaimFee
explorerTxUrl
feToBytes
formatXlm
formatXlmDisplay
fullProve
fund
g1ToBytes
g2ToBytes
generateIdentity
generateProof
getCircle
getCircleCount
getCircleStatus
getContributors
getPot
getRound
getStatus
hasClaimed
isTestnet
makeCircleId
networkOf
parseContractErrorCode
populateTxResult
poseidon
prove
randomFieldElement
resolveSigner
stroopsToXlm
validateCircuitInput
validateContractProof
validateContractVerificationKey
verificationKeyToContractFormat
verifyProofLocally
withRetry
xlmToStroops
```

### Types

```ts
CircleView
CircuitInput
ContractProof
ContractVerificationKey
FeeEstimate
GenerateProofResult
Identity
MerkleProof
ProofResult
ShariboClient
ShariboNetworkConfig
ShariboSigner
TxResult
```
