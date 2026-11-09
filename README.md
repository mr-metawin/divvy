# Divvy

> Everyone gets their cut.

Divvy is a minimal, trustless payment splitter for native BOT on the BOT Testnet. Someone creates a split by naming it and listing recipient wallets with a percentage each (for a band, a team, roommates, or co-founders). Anyone can then send native BOT to that split, and each member withdraws their cut whenever they like.

---

## Deployed Contract

- **Network**: BOT Testnet
- **Chain ID**: 968
- **RPC URL**: `https://rpc.bohr.life`
- **Native Currency**: BOT (18 decimals)
- **Explorer**: `https://scan.bohr.life`
- **Contract Address**: [`0x4b76926f74117429eb4869f875Cf402BE05997C1`](https://scan.bohr.life/address/0x4b76926f74117429eb4869f875Cf402BE05997C1)

---

## Important Notes

1. **Permanent & Immutable**: Splits are fixed once created. There is no owner, no admin, no fee, and no function to edit or delete members or their percentage shares.
2. **Rounding Dust**: Because each member's share is calculated with integer division rounded down (`(totalReceived * bps) / 10_000`), a few wei of dust can stay in the contract. The dust left behind is always strictly less than the number of members in the split.
3. **No Direct Transfers**: Direct native BOT transfers to the contract address revert. Payments must route through `pay(id)` or via the frontend interface.
4. **Unaudited Demo**: This project is an unaudited testnet demo built for the BOT Testnet hackathon / ecosystem showcase.

---

## Project Structure

```text
divvy/
├── contracts/               # Foundry smart contracts
│   ├── src/
│   │   └── Divvy.sol        # Core payment splitter contract
│   ├── test/
│   │   ├── Divvy.t.sol      # Unit, edge-case, reentrancy, rejection, and fuzz tests
│   │   └── DivvyInvariant.t.sol # Invariant tests across multi-split lifecycles
│   ├── script/
│   │   └── Deploy.s.sol     # Foundry deployment script
│   └── foundry.toml         # Foundry configuration (solc 0.8.24)
├── frontend/                # Vite + React + TypeScript + Viem
│   ├── src/
│   │   ├── contracts/       # Address, ABI, and viem chain configuration
│   │   ├── App.tsx          # Main single-page application with hash routing
│   │   ├── App.css          # Dark theme styles (mint green & warm yellow accents)
│   │   ├── utils.ts         # Formatting, error parsing & explorer links
│   │   └── types.ts         # TypeScript definitions
│   └── index.html           # HTML entry with tagline and meta tags
└── README.md
```

---

## Contract Setup & Testing

### Prerequisites
- [Foundry](https://getfoundry.sh/) (`forge`, `cast`)
- Node.js (v18+)

### Build Contracts
```bash
cd contracts
forge build
```

### Run Tests
```bash
forge test -vvv
```
All 25 unit, edge-case, reentrancy, rejection, fuzz, and invariant tests will execute and pass.

---

## Deployment (Foundry)

To deploy to the BOT Testnet using an existing cast keystore account:

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://rpc.bohr.life \
  --account divvy \
  --password-file <path-to-gitignored-password-file> \
  --broadcast
```

*Note: Keystore passwords should never be committed to git or printed in logs.*

---

## Frontend Setup & Run

### Install & Build
```bash
cd frontend
npm run build
```

### Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Deploy to Cloudflare (Workers / Pages)
Using Wrangler:
```bash
# From frontend directory:
npm run build
npx wrangler deploy

# Or from project root:
npx wrangler deploy
```

---

## User Flow

1. **Connect Wallet**: Connect MetaMask or any EIP-1193 wallet. If on an unsupported network, use the "Switch to BOT Testnet" button.
2. **Create a Split** (`#/`):
   - Enter a split name (max 50 chars).
   - Add between 2 and 20 member wallets.
   - Use the **⚡ Split equally** button or enter custom percentages (up to 2 decimals).
   - Ensure the live total equals exactly `100.00%`.
   - Click **Create Split** and confirm the transaction.
3. **Send BOT to a Split** (`#/split/<id>`):
   - Navigate to the split page.
   - Enter an amount of BOT and click **Pay Split**.
4. **Withdraw Cut**:
   - Members can see their live claimable balance on the split page or in the **My splits** section.
   - Click **Withdraw** to claim native BOT into your wallet at any time.
