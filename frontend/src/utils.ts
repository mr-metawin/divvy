import { formatEther } from 'viem';

export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatBOT(amountWei: bigint): string {
  const str = formatEther(amountWei);
  const num = parseFloat(str);
  if (num === 0) return '0 BOT';
  if (num < 0.0001 && num > 0) return '<0.0001 BOT';
  return `${num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })} BOT`;
}

export function formatBps(bps: number | bigint): string {
  const num = typeof bps === 'bigint' ? Number(bps) : bps;
  return `${(num / 100).toFixed(2).replace(/\.00$/, '')}%`;
}

export function formatRelativeTime(timestampSec: bigint | number): string {
  const now = Math.floor(Date.now() / 1000);
  const ts = typeof timestampSec === 'bigint' ? Number(timestampSec) : timestampSec;
  const diff = now - ts;

  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export const EXPLORER_URL = 'https://scan.bohr.life';

export function explorerTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

export function parseContractError(err: any): string {
  if (!err) return 'Unknown error occurred.';
  const message = String(err?.message || err);

  if (message.includes('User rejected') || message.includes('denied transaction signature')) {
    return 'Transaction rejected in wallet.';
  }
  if (message.includes('InvalidNameLength')) {
    return 'Name must be between 1 and 50 characters.';
  }
  if (message.includes('InvalidMemberCount')) {
    return 'A split must have between 2 and 20 members.';
  }
  if (message.includes('ArrayLengthMismatch')) {
    return 'Member list and percentage shares count mismatch.';
  }
  if (message.includes('ZeroAddress')) {
    return 'Cannot include zero address (0x0...0) as member.';
  }
  if (message.includes('DuplicateMember')) {
    return 'Duplicate member addresses are not allowed.';
  }
  if (message.includes('InvalidBps')) {
    return 'Every member share must be greater than 0%.';
  }
  if (message.includes('TotalBpsNot10000')) {
    return 'Total shares must add up to exactly 100.00%.';
  }
  if (message.includes('SplitDoesNotExist')) {
    return 'Split does not exist on BOT Testnet.';
  }
  if (message.includes('ZeroPayment')) {
    return 'Payment amount must be greater than 0 BOT.';
  }
  if (message.includes('NotAMember')) {
    return 'Your connected wallet is not a member of this split.';
  }
  if (message.includes('NothingOwed')) {
    return 'No BOT claimable to withdraw at this time.';
  }
  if (message.includes('TransferFailed')) {
    return 'Native BOT transfer failed.';
  }
  if (message.includes('insufficient funds')) {
    return 'Insufficient BOT for gas or transfer amount.';
  }

  // Shorten generic RPC errors if too verbose
  const shortMatch = message.match(/reverted with custom error '([^']+)'/);
  if (shortMatch) {
    return `Transaction reverted: ${shortMatch[1]}`;
  }

  if (err?.shortMessage) return err.shortMessage;
  return message.slice(0, 160);
}
