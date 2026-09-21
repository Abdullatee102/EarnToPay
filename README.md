# EarnToPay

**EarnToPay** is a production-ready Web3 application that bridges earning, spending, and withdrawing into a single on-chain ecosystem on **Bohr Testnet** (Chain ID: `968`, Native Token: `BOT`).

Users complete platform-defined tasks, have their completions verified by an authorized platform administrator, receive native BOT rewards from a funded reward pool into their available earned balance, and use that earned balance to either **pay merchants for real-world products/services** or **withdraw directly to their connected wallet**.

---

## 1. Core Economic Flow

```text
Platform Administrator
        ↓
Creates Earning Task (e.g., 10 BOT)
        ↓
User Completes Task & Submits Proof Note
        ↓
Admin Reviews & Approves Completion On-Chain
        ↓
Reward Issued from Funded Reward Pool
        ↓
User's EarnToPay Earned Balance Increases (+10 BOT)
        ↓
   ┌─────────────────────────────┴─────────────────────────────┐
   ▼                                                           ▼
Pay Merchant                                            Withdraw to Wallet
(Merchant receives BOT on-chain)                   (User wallet receives BOT on-chain)
   │                                                           │
   └─────────────────────────────┬─────────────────────────────┘
                                 ▼
                    Payment / Withdrawal Receipt
                     & On-Chain Activity Logged
```

---

## 2. Blockchain & Deployment Details

| Parameter                   | Value                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live Web3 Application**   | [https://earn-to-pay.vercel.app/](https://earn-to-pay.vercel.app/)                                                                                                   |
| **Network**                 | Bohr Testnet                                                                                                                                                         |
| **Chain ID**                | `968`                                                                                                                                                                |
| **Native Token**            | BOT                                                                                                                                                                  |
| **RPC Endpoint**            | `https://rpc.bohr.life`                                                                                                                                              |
| **Block Explorer**          | `https://scan.bohr.life/`                                                                                                                                            |
| **Contract Name**           | `EarnToPay`                                                                                                                                                          |
| **Contract Address**        | [`0xadceA08A5188538904E6666C59021Bd4e9548CEB`](https://scan.bohr.life/address/0xadceA08A5188538904E6666C59021Bd4e9548CEB)                                            |
| **Deployer / Admin Wallet** | `0x97184EBAEB9FDCe449d5FbaF1311601005F8E811`                                                                                                                         |
| **Deployment Transaction**  | [`0x5fa2febd28ab66f527d5d49b696f53722368f0f1e74819650c943339f7b059a1`](https://scan.bohr.life/tx/0x5fa2febd28ab66f527d5d49b696f53722368f0f1e74819650c943339f7b059a1) |

---

## 3. Architecture & Security Model

The repository strictly contains only two top-level application folders:

```text
Earn_Pay/
├── contract/       # Foundry smart contract, comprehensive unit tests, deployment scripts
└── frontend/       # React 19 + TypeScript + Vite + Wagmi v2 + Reown AppKit + TanStack Query
```

### Smart Contract (`contract/src/EarnToPay.sol`)

- **Admin Access Control**: Enforced through `msg.sender == admin` on all privileged operations (`createTask`, `updateTask`, `setTaskActive`, `approveCompletion`, `issueReward`, `approveAndIssueReward`, `withdrawUnallocated`, `transferAdmin`).
- **Reward Pool Segregation**: Native BOT is funded into `rewardPool` via `fundRewardPool()`. Reward issuance strictly validates `rewardPool >= reward` before deducting and crediting user earned balance.
- **User Withdrawal (`withdrawEarned`)**: Users can withdraw partial or full approved earned balances directly to their connected wallet address. The contract enforces `earnedBalance[msg.sender] >= amount` and transfers native BOT atomically.
- **Economic Invariant**: Users cannot spend or withdraw more than `earnedBalance[msg.sender]`.
- **Reentrancy Protection**: Uses OpenZeppelin's `ReentrancyGuard` on all state-modifying functions transferring native tokens.
- **Checks-Effects-Interactions**: All mappings (`earnedBalance`, `totalWithdrawn`, `paymentRequests`, `completions`) are updated and events are emitted prior to external native BOT transfers.

### User Withdrawal Features

- **Automatic Address Routing**: Withdraws directly to the user's currently connected wallet address without requiring manual error-prone address entry.
- **Flexible Amounts**: Supports full ("MAX") or custom partial withdrawals (with 25%, 50%, 75%, 100% quick selectors).
- **Instant Settlement**: Executes on-chain via Bohr Testnet with instant receipts and explorer links.

---

## 4. Frontend Application Structure

- **Home (`/`)**: Overview of the EarnToPay flow, live user earned balances (`Available to Spend / Withdraw`, `Total Earned`, `Total Withdrawn`, `Total Spent`), **Withdraw BOT** modal, platform statistics, quick action cards, and recent on-chain activity timeline.
- **Earn (`/earn`)**: Catalog of active earning tasks with rewards in BOT. Users submit task completion proofs, monitor review/approval status, and receive real-time transaction updates.
- **Pay (`/pay`)**: Browse available merchant payment requests, view balance-vs-cost calculation previews, execute payments with one click, and inspect generated payment receipts linked to Bohr Scan.
- **Activity (`/activity`)**: Real-time event log fetched directly from Bohr Testnet via Viem `getLogs` (`RewardIssued`, `RewardWithdrawn`, `PaymentCompleted`, `CompletionSubmitted`).
- **Admin (`/admin`)**: Protected management suite for the contract administrator to create tasks, toggle active states, review and approve user completions, issue rewards, fund the reward pool, and manage dashboard password security.

---

## 5. Development & Testing

### Smart Contract (Foundry)

```bash
cd contract
forge build
forge test -v
```

Unit and integration test suite covers admin permissions, reward pool solvency, task lifecycles, user withdrawals (full, partial, zero amount, insufficient balance, reentrancy), payment execution, and balance invariants.

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run build      # Runs TypeScript check & Vite production bundle
npm run typecheck  # Validates all TypeScript types
npm run dev        # Starts local development server
```

---

## 6. Environment Configuration

### Frontend (`frontend/.env.example`)

```env
VITE_REOWN_PROJECT_ID=your_reown_project_id_here
VITE_BOHR_CHAIN_ID=968
VITE_BOHR_RPC_URL=https://rpc.bohr.life
VITE_EXPLORER_URL=https://scan.bohr.life/
VITE_EARN_TO_PAY_CONTRACT_ADDRESS=0xadceA08A5188538904E6666C59021Bd4e9548CEB
VITE_ADMIN_PASSWORD_HASH=1c5b945254a4ac63754a2a8fa66241cfa4521463cbf7f62dc976fe990b5ce2e9
```
