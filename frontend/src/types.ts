export interface SplitMeta {
  id: bigint;
  creator: `0x${string}`;
  name: string;
  totalReceived: bigint;
  createdAt: bigint;
}

export interface MemberInfo {
  address: `0x${string}`;
  bps: number;
  percent: number;
  released: bigint;
  claimable: bigint;
}

export interface UserSplitSummary {
  id: bigint;
  name: string;
  myBps: number;
  myPercent: number;
  totalReceived: bigint;
  claimableNow: bigint;
}

export interface TxStatus {
  state: 'idle' | 'pending' | 'success' | 'error';
  message?: string;
  hash?: `0x${string}`;
}
