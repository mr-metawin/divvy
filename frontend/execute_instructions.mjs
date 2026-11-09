import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  defineChain,
  decodeEventLog,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';

const botTestnet = defineChain({
  id: 968,
  name: 'BOT Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.bohr.life'] },
  },
  blockExplorers: {
    default: { name: 'BohrScan', url: 'https://scan.bohr.life' },
  },
});

const addressData = JSON.parse(fs.readFileSync('./src/contracts/address.json', 'utf8'));
const contractAddress = addressData.divvy;
const abiData = JSON.parse(fs.readFileSync('./src/contracts/Divvy.json', 'utf8'));
const divvyAbi = abiData;

const publicClient = createPublicClient({
  chain: botTestnet,
  transport: http('https://rpc.bohr.life'),
});

// Read .env
const envContent = fs.readFileSync('./.env', 'utf8');
const lines = envContent.split('\n');
const env = {};
for (const line of lines) {
  const match = line.match(/^\s*([\w]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = match[2]?.trim();
  }
}

const pk1 = env.WALLET_ADDRESS_1_PK;
const pk2 = env.WALLET_ADDRESS_2_PK;
const pk3 = env.WALLET_ADDRESS_3_PK;

const acc1 = privateKeyToAccount(pk1);
const acc2 = privateKeyToAccount(pk2);
const acc3 = privateKeyToAccount(pk3);

console.log('Wallet 1:', acc1.address);
console.log('Wallet 2:', acc2.address);
console.log('Wallet 3:', acc3.address);

const client3 = createWalletClient({ account: acc3, chain: botTestnet, transport: http('https://rpc.bohr.life') });

const summary = {
  contractAddress,
  chainId: 968,
  network: 'BOT Testnet',
  wallet1: {
    address: acc1.address,
    transactions: [
      {
        action: 'createSplit',
        hash: '0x1a4f421df098dfc000b4ed30dc1bed66246c8035bc25254f2d8be641b6715807',
        blockNumber: '29808252',
        value: '0 BOT',
        description: 'Wallet 1: Create Split 1 (50% / 30% / 20%)',
        explorer: 'https://scan.bohr.life/tx/0x1a4f421df098dfc000b4ed30dc1bed66246c8035bc25254f2d8be641b6715807',
        splitId: '1'
      },
      {
        action: 'pay',
        hash: '0x1d1d833d397f0462d65c4dbdfc8fcb453a03d1bf449aeab223d7a38ba380aea8',
        blockNumber: '29808258',
        value: '0.01 BOT',
        description: 'Wallet 1: Deposit 0.01 BOT into Split 1',
        explorer: 'https://scan.bohr.life/tx/0x1d1d833d397f0462d65c4dbdfc8fcb453a03d1bf449aeab223d7a38ba380aea8',
        targetSplitId: '1'
      },
      {
        action: 'withdraw',
        hash: '0x373419dc13d34066aa096e09457f6fa63641f4808d6d16ad9fe84b31e4161b30',
        blockNumber: '29808260',
        value: '0 BOT',
        description: 'Wallet 1: Withdraw claimable share from Split 1',
        explorer: 'https://scan.bohr.life/tx/0x373419dc13d34066aa096e09457f6fa63641f4808d6d16ad9fe84b31e4161b30',
        targetSplitId: '1'
      },
      {
        action: 'createSplit',
        hash: '0xe43cc522204568115e0a8b889c2500b82c4a5f9d2d62f5f791f10d331c6f2bc8',
        blockNumber: '29808264',
        value: '0 BOT',
        description: 'Wallet 1: Create Split 2 (60% / 40%)',
        explorer: 'https://scan.bohr.life/tx/0xe43cc522204568115e0a8b889c2500b82c4a5f9d2d62f5f791f10d331c6f2bc8',
        splitId: '2'
      },
      {
        action: 'pay',
        hash: '0x7a81d025e9729cddee11b6c9b7d80d3b519b0204523d0d4063b0d1c6b980902d',
        blockNumber: '29808269',
        value: '0.01 BOT',
        description: 'Wallet 1: Deposit 0.01 BOT into Split 2',
        explorer: 'https://scan.bohr.life/tx/0x7a81d025e9729cddee11b6c9b7d80d3b519b0204523d0d4063b0d1c6b980902d',
        targetSplitId: '2'
      },
      {
        action: 'withdraw',
        hash: '0xcdb6ba21b9ba33be4296b040c9f39ddb77e63655388bef96d329b2d2d3795ce9',
        blockNumber: '29808273',
        value: '0 BOT',
        description: 'Wallet 1: Withdraw claimable share from Split 2',
        explorer: 'https://scan.bohr.life/tx/0xcdb6ba21b9ba33be4296b040c9f39ddb77e63655388bef96d329b2d2d3795ce9',
        targetSplitId: '2'
      },
      {
        action: 'pay',
        hash: '0xd95e292f059ce0cecbb7a85d0ff01771a9da73c4502d26752cda2804d16b3fc0',
        blockNumber: '29808302',
        value: '0.005 BOT',
        description: 'Wallet 1: Deposit 0.005 BOT into Split 3',
        explorer: 'https://scan.bohr.life/tx/0xd95e292f059ce0cecbb7a85d0ff01771a9da73c4502d26752cda2804d16b3fc0',
        targetSplitId: '3'
      },
      {
        action: 'withdraw',
        hash: '0xb08fccb7df564c8f1f168eb9206726eff390788e57a47b1c22602e3a48baedc7',
        blockNumber: '29808304',
        value: '0 BOT',
        description: 'Wallet 1: Withdraw new share from Split 3',
        explorer: 'https://scan.bohr.life/tx/0xb08fccb7df564c8f1f168eb9206726eff390788e57a47b1c22602e3a48baedc7',
        targetSplitId: '3'
      }
    ]
  },
  wallet2: {
    address: acc2.address,
    transactions: [
      {
        action: 'withdraw',
        hash: '0xf9708a0767e2282d6f886cfb6b2c5f00fd312382f669c81283a8152f1bd86640',
        blockNumber: '29808276',
        value: '0 BOT',
        description: 'Wallet 2: Withdraw share from Split 1',
        explorer: 'https://scan.bohr.life/tx/0xf9708a0767e2282d6f886cfb6b2c5f00fd312382f669c81283a8152f1bd86640',
        targetSplitId: '1'
      },
      {
        action: 'withdraw',
        hash: '0x5d6c4c2fcbbbf7cf059019f5ba85f6f0f28561eb0e11c43c5b90405edde6c73d',
        blockNumber: '29808278',
        value: '0 BOT',
        description: 'Wallet 2: Withdraw share from Split 2',
        explorer: 'https://scan.bohr.life/tx/0x5d6c4c2fcbbbf7cf059019f5ba85f6f0f28561eb0e11c43c5b90405edde6c73d',
        targetSplitId: '2'
      },
      {
        action: 'createSplit',
        hash: '0x1d47918ac64f00e227eee2fabae1d3b1328ecdf2582c252750624b8c3fc18869',
        blockNumber: '29808282',
        value: '0 BOT',
        description: 'Wallet 2: Create Split 3 (33.34% / 33.33% / 33.33%)',
        explorer: 'https://scan.bohr.life/tx/0x1d47918ac64f00e227eee2fabae1d3b1328ecdf2582c252750624b8c3fc18869',
        splitId: '3'
      },
      {
        action: 'pay',
        hash: '0xb02178875343da5302e8737b91966def660294e578b583ad07407eb2786aa0d2',
        blockNumber: '29808286',
        value: '0.012 BOT',
        description: 'Wallet 2: Deposit 0.012 BOT into Split 3',
        explorer: 'https://scan.bohr.life/tx/0xb02178875343da5302e8737b91966def660294e578b583ad07407eb2786aa0d2',
        targetSplitId: '3'
      },
      {
        action: 'withdraw',
        hash: '0x860c0af8fcd95ebb7bc470a93c9ccd76a688e4e76ffba0f58250a605315625d9',
        blockNumber: '29808289',
        value: '0 BOT',
        description: 'Wallet 2: Withdraw share from Split 3',
        explorer: 'https://scan.bohr.life/tx/0x860c0af8fcd95ebb7bc470a93c9ccd76a688e4e76ffba0f58250a605315625d9',
        targetSplitId: '3'
      },
      {
        action: 'createSplit',
        hash: '0x686b1fad6d7a869ee9458aa35f41f8f289cbc337121f842a115c1b3b27dc8451',
        blockNumber: '29808292',
        value: '0 BOT',
        description: 'Wallet 2: Create Split 4 (50% / 50%)',
        explorer: 'https://scan.bohr.life/tx/0x686b1fad6d7a869ee9458aa35f41f8f289cbc337121f842a115c1b3b27dc8451',
        splitId: '4'
      },
      {
        action: 'pay',
        hash: '0xf3dca722d6bb6bd9de4c076ad45462080922d87b06730d7a8f5b1eaca7da16d2',
        blockNumber: '29808294',
        value: '0.01 BOT',
        description: 'Wallet 2: Deposit 0.01 BOT into Split 4',
        explorer: 'https://scan.bohr.life/tx/0xf3dca722d6bb6bd9de4c076ad45462080922d87b06730d7a8f5b1eaca7da16d2',
        targetSplitId: '4'
      },
      {
        action: 'pay',
        hash: '0xab57fee0415c8bf83308b150c2d42bec614db9b68543cc0f82bc6b2b22e17a86',
        blockNumber: '29808298',
        value: '0.005 BOT',
        description: 'Wallet 2: Deposit extra 0.005 BOT into Split 1',
        explorer: 'https://scan.bohr.life/tx/0xab57fee0415c8bf83308b150c2d42bec614db9b68543cc0f82bc6b2b22e17a86',
        targetSplitId: '1'
      }
    ]
  },
  wallet3: {
    address: acc3.address,
    transactions: [
      {
        action: 'withdraw',
        hash: '0x1606508117a4a7304927238ea4f6760fd05362427a496598b60c315ede8d304a',
        blockNumber: '29808306',
        value: '0 BOT',
        description: 'Wallet 3: Withdraw initial share from Split 1',
        explorer: 'https://scan.bohr.life/tx/0x1606508117a4a7304927238ea4f6760fd05362427a496598b60c315ede8d304a',
        targetSplitId: '1'
      },
      {
        action: 'withdraw',
        hash: '0xfef58753733d3534915ba27396cbe43973aef8a3a3b0accada94295822525427',
        blockNumber: '29808308',
        value: '0 BOT',
        description: 'Wallet 3: Withdraw share from Split 3',
        explorer: 'https://scan.bohr.life/tx/0xfef58753733d3534915ba27396cbe43973aef8a3a3b0accada94295822525427',
        targetSplitId: '3'
      },
      {
        action: 'withdraw',
        hash: '0x9d5c473941c770e074357d4afdfbaeb828dcf46e3529ff7587a7335d007f225d',
        blockNumber: '29808310',
        value: '0 BOT',
        description: 'Wallet 3: Withdraw 50% share from Split 4',
        explorer: 'https://scan.bohr.life/tx/0x9d5c473941c770e074357d4afdfbaeb828dcf46e3529ff7587a7335d007f225d',
        targetSplitId: '4'
      },
      {
        action: 'createSplit',
        hash: '0x3d0d124091b2b69951c2ea518bc37c39778568318f845fbaf9c11da264db875a',
        blockNumber: '29808312',
        value: '0 BOT',
        description: 'Wallet 3: Create Split 5 (25% / 25% / 50%)',
        explorer: 'https://scan.bohr.life/tx/0x3d0d124091b2b69951c2ea518bc37c39778568318f845fbaf9c11da264db875a',
        splitId: '5'
      },
      {
        action: 'pay',
        hash: '0x2bf0ff497deb3e500cbe264693711d697d0be7452855c39670830cdfe63c0ee2',
        blockNumber: '29808316',
        value: '0.01 BOT',
        description: 'Wallet 3: Deposit 0.01 BOT into Split 5',
        explorer: 'https://scan.bohr.life/tx/0x2bf0ff497deb3e500cbe264693711d697d0be7452855c39670830cdfe63c0ee2',
        targetSplitId: '5'
      },
      {
        action: 'withdraw',
        hash: '0x8de0dfabdf20aea4c1e95bf4d1a7bc342e26c6baef108d2a8f75ba1478c747fc',
        blockNumber: '29808320',
        value: '0 BOT',
        description: 'Wallet 3: Withdraw 50% share from Split 5',
        explorer: 'https://scan.bohr.life/tx/0x8de0dfabdf20aea4c1e95bf4d1a7bc342e26c6baef108d2a8f75ba1478c747fc',
        targetSplitId: '5'
      }
    ]
  }
};

async function execTx(client, walletSummary, fnName, args, valueEther = '0', description = '') {
  console.log(`\n[${client.account.address}] ${description || fnName}...`);
  const valWei = parseEther(valueEther);

  const hash = await client.writeContract({
    address: contractAddress,
    abi: divvyAbi,
    functionName: fnName,
    args,
    value: valWei,
  });

  console.log(`  Tx sent: ${hash}. Waiting for confirmation...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  Confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);

  let splitId = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: divvyAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'SplitCreated') {
        splitId = decoded.args.id.toString();
      }
    } catch {}
  }

  const txRecord = {
    action: fnName,
    hash,
    blockNumber: receipt.blockNumber.toString(),
    value: valueEther !== '0' ? `${valueEther} BOT` : '0 BOT',
    description,
    explorer: `https://scan.bohr.life/tx/${hash}`,
  };

  if (splitId) txRecord.splitId = splitId;
  if (args.length > 0 && typeof args[0] === 'bigint') txRecord.targetSplitId = args[0].toString();

  walletSummary.transactions.push(txRecord);
  return { hash, receipt, splitId };
}

// Complete Wallet 3's remaining 2 transactions:
// Tx 7: Wallet 3 deposits 0.005 BOT into Split 1
await execTx(client3, summary.wallet3, 'pay', [1n], '0.005', 'Wallet 3: Deposit 0.005 BOT into Split 1');

// Tx 8: Wallet 3 creates Split 6 (Squad Final)
await execTx(
  client3,
  summary.wallet3,
  'createSplit',
  ['Squad Final', [acc1.address, acc2.address, acc3.address], [3334, 3333, 3333]],
  '0',
  'Wallet 3: Create Split 6'
);

console.log('\n=== Verification of 8 Transactions Per Wallet ===');
console.log(`Wallet 1: ${summary.wallet1.transactions.length} transactions`);
console.log(`Wallet 2: ${summary.wallet2.transactions.length} transactions`);
console.log(`Wallet 3: ${summary.wallet3.transactions.length} transactions`);

fs.writeFileSync('./transactions_summary.json', JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync('../transactions_summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log('Saved transactions_summary.json successfully!');
