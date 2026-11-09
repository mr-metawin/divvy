import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  isAddress,
  getAddress,
  decodeEventLog,
} from 'viem';
import { contractAddress, divvyAbi, botTestnet } from './contracts';
import { SplitMeta, MemberInfo, UserSplitSummary, TxStatus } from './types';
import {
  shortenAddress,
  formatBOT,
  formatBps,
  formatRelativeTime,
  explorerTxUrl,
  explorerAddressUrl,
  parseContractError,
} from './utils';
import appLogo from './assets/divvy.jpeg';
import './App.css';

const publicClient = createPublicClient({
  chain: botTestnet,
  transport: http('https://rpc.bohr.life'),
});

interface MemberRow {
  address: string;
  percent: string;
}

export const App: React.FC = () => {
  // Navigation / Hash routing
  const [, setCurrentHash] = useState<string>(window.location.hash || '#/');

  // Wallet state
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  // Transaction banner
  const [txStatus, setTxStatus] = useState<TxStatus>({ state: 'idle' });

  // Lookup state
  const [lookupIdInput, setLookupIdInput] = useState('');

  // Create Split Form State
  const [splitName, setSplitName] = useState('');
  const [rows, setRows] = useState<MemberRow[]>([
    { address: '', percent: '50.00' },
    { address: '', percent: '50.00' },
  ]);
  const [creatingSplit, setCreatingSplit] = useState(false);

  // User Splits list state
  const [mySplits, setMySplits] = useState<UserSplitSummary[]>([]);
  const [loadingMySplits, setLoadingMySplits] = useState(false);

  // Active Split Detail State
  const [activeSplitId, setActiveSplitId] = useState<bigint | null>(null);
  const [splitDetail, setSplitDetail] = useState<SplitMeta | null>(null);
  const [splitMembers, setSplitMembers] = useState<MemberInfo[]>([]);
  const [loadingSplitDetail, setLoadingSplitDetail] = useState(false);
  const [splitDetailError, setSplitDetailError] = useState<string | null>(null);

  // Payment Form State
  const [payAmountInput, setPayAmountInput] = useState('0.1');
  const [paying, setPaying] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // Copy notification
  const [copiedLink, setCopiedLink] = useState(false);

  const isCorrectChain = chainId === botTestnet.id;

  // Handle Hash Routing
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash || '#/';
      setCurrentHash(h);
      if (h.startsWith('#/split/')) {
        const idPart = h.replace('#/split/', '').split('?')[0].split('/')[0];
        try {
          const id = BigInt(idPart);
          setActiveSplitId(id);
        } catch {
          setActiveSplitId(null);
        }
      } else {
        setActiveSplitId(null);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Wallet event listeners
  useEffect(() => {
    if (window.ethereum) {
      const handleAccounts = (accs: any) => {
        if (Array.isArray(accs) && accs.length > 0) {
          try {
            setAccount(getAddress(accs[0]));
          } catch {
            setAccount(accs[0]);
          }
        } else {
          setAccount(null);
        }
      };

      const handleChain = (hexId: string) => {
        setChainId(parseInt(hexId, 16));
      };

      window.ethereum.request({ method: 'eth_accounts' }).then(handleAccounts).catch(() => {});
      window.ethereum.request({ method: 'eth_chainId' }).then(handleChain).catch(() => {});

      window.ethereum.on?.('accountsChanged', handleAccounts);
      window.ethereum.on?.('chainChanged', handleChain);

      return () => {
        window.ethereum?.removeListener?.('accountsChanged', handleAccounts);
        window.ethereum?.removeListener?.('chainChanged', handleChain);
      };
    }
  }, []);

  const getWalletClient = () => {
    if (!window.ethereum) throw new Error('MetaMask or Web3 wallet not detected');
    return createWalletClient({
      chain: botTestnet,
      transport: custom(window.ethereum),
    });
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask or a compatible Web3 wallet.');
        return;
      }
      const client = getWalletClient();
      const [addr] = await client.requestAddresses();
      setAccount(getAddress(addr));
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      setChainId(parseInt(chainIdHex, 16));
    } catch (err: any) {
      setTxStatus({ state: 'error', message: parseContractError(err) });
    }
  };

  const switchToBotTestnet = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x3c8' }], // 968 in hex
      });
    } catch (switchError: any) {
      if (switchError.code === 4902 || switchError?.message?.includes('Unrecognized')) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x3c8',
                chainName: 'BOT Testnet',
                nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
                rpcUrls: ['https://rpc.bohr.life'],
                blockExplorerUrls: ['https://scan.bohr.life'],
              },
            ],
          });
        } catch (addError) {
          console.error(addError);
        }
      }
    }
  };

  // Convert row percentage to basis points
  const percentToBps = (val: string): number => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * 100);
  };

  // Live total basis points
  const totalBps = useMemo(() => {
    return rows.reduce((sum, r) => sum + percentToBps(r.percent), 0);
  }, [rows]);

  const isTotalValid = totalBps === 10000;

  // Validation for Create Split
  const isCreateFormValid = useMemo(() => {
    if (!splitName.trim() || splitName.trim().length > 50) return false;
    if (rows.length < 2 || rows.length > 20) return false;
    if (!isTotalValid) return false;

    const addressSet = new Set<string>();
    for (const r of rows) {
      const cleanAddr = r.address.trim();
      if (!isAddress(cleanAddr)) return false;
      const lower = cleanAddr.toLowerCase();
      if (addressSet.has(lower)) return false; // Duplicate
      addressSet.add(lower);
      if (percentToBps(r.percent) === 0) return false;
    }

    return true;
  }, [splitName, rows, isTotalValid]);

  // "Split equally" algorithm
  const handleSplitEqually = () => {
    const count = rows.length;
    if (count < 2) return;
    const baseBps = Math.floor(10000 / count);
    const remainder = 10000 - baseBps * count;

    setRows((prev) =>
      prev.map((r, i) => {
        const personBps = i === 0 ? baseBps + remainder : baseBps;
        return {
          ...r,
          percent: (personBps / 100).toFixed(2),
        };
      })
    );
  };

  const handleAddMember = () => {
    if (rows.length >= 20) return;
    setRows((prev) => [...prev, { address: '', percent: '0.00' }]);
  };

  const handleRemoveMember = (index: number) => {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof MemberRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Fetch "My Splits"
  const fetchMySplits = useCallback(async () => {
    if (!account) {
      setMySplits([]);
      return;
    }

    try {
      setLoadingMySplits(true);
      const splitIds = (await publicClient.readContract({
        address: contractAddress,
        abi: divvyAbi,
        functionName: 'getSplitIdsByMember',
        args: [account],
      })) as bigint[];

      // Unique ids descending
      const uniqueIds = Array.from(new Set(splitIds.map((id) => id.toString())))
        .map((s) => BigInt(s))
        .reverse();

      const summaries: UserSplitSummary[] = await Promise.all(
        uniqueIds.map(async (id) => {
          const split = (await publicClient.readContract({
            address: contractAddress,
            abi: divvyAbi,
            functionName: 'getSplit',
            args: [id],
          })) as { creator: `0x${string}`; name: string; totalReceived: bigint; createdAt: bigint };

          const [members, bps] = (await publicClient.readContract({
            address: contractAddress,
            abi: divvyAbi,
            functionName: 'getMembers',
            args: [id],
          })) as [`0x${string}`[], number[]];

          const claimable = (await publicClient.readContract({
            address: contractAddress,
            abi: divvyAbi,
            functionName: 'claimable',
            args: [id, account],
          })) as bigint;

          const myIndex = members.findIndex((m) => m.toLowerCase() === account.toLowerCase());
          const myBps = myIndex >= 0 ? bps[myIndex] : 0;

          return {
            id,
            name: split.name,
            myBps,
            myPercent: myBps / 100,
            totalReceived: split.totalReceived,
            claimableNow: claimable,
          };
        })
      );

      setMySplits(summaries);
    } catch (err) {
      console.error('Failed to fetch user splits:', err);
    } finally {
      setLoadingMySplits(false);
    }
  }, [account]);

  // Fetch Split Detail
  const fetchSplitDetail = useCallback(async (id: bigint) => {
    try {
      setLoadingSplitDetail(true);
      setSplitDetailError(null);

      const split = (await publicClient.readContract({
        address: contractAddress,
        abi: divvyAbi,
        functionName: 'getSplit',
        args: [id],
      })) as { creator: `0x${string}`; name: string; totalReceived: bigint; createdAt: bigint };

      const [members, bps] = (await publicClient.readContract({
        address: contractAddress,
        abi: divvyAbi,
        functionName: 'getMembers',
        args: [id],
      })) as [`0x${string}`[], number[]];

      const memberDetails: MemberInfo[] = await Promise.all(
        members.map(async (addr, idx) => {
          const released = (await publicClient.readContract({
            address: contractAddress,
            abi: divvyAbi,
            functionName: 'released',
            args: [id, addr],
          })) as bigint;

          const claimable = (await publicClient.readContract({
            address: contractAddress,
            abi: divvyAbi,
            functionName: 'claimable',
            args: [id, addr],
          })) as bigint;

          return {
            address: addr,
            bps: bps[idx],
            percent: bps[idx] / 100,
            released,
            claimable,
          };
        })
      );

      setSplitDetail({
        id,
        creator: split.creator,
        name: split.name,
        totalReceived: split.totalReceived,
        createdAt: split.createdAt,
      });
      setSplitMembers(memberDetails);
    } catch (err: any) {
      setSplitDetailError(parseContractError(err));
      setSplitDetail(null);
      setSplitMembers([]);
    } finally {
      setLoadingSplitDetail(false);
    }
  }, []);

  // Polling every 4 seconds
  useEffect(() => {
    fetchMySplits();
    if (activeSplitId !== null) {
      fetchSplitDetail(activeSplitId);
    }

    const interval = setInterval(() => {
      fetchMySplits();
      if (activeSplitId !== null) {
        fetchSplitDetail(activeSplitId);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchMySplits, fetchSplitDetail, activeSplitId]);

  // Create Split Action
  const handleCreateSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreateFormValid || !account) return;

    try {
      setCreatingSplit(true);
      setTxStatus({ state: 'pending', message: 'Submitting split creation transaction...' });

      const client = getWalletClient();
      const memberAddresses = rows.map((r) => getAddress(r.address.trim()));
      const memberBps = rows.map((r) => percentToBps(r.percent));

      const hash = await client.writeContract({
        address: contractAddress,
        abi: divvyAbi,
        functionName: 'createSplit',
        args: [splitName.trim(), memberAddresses, memberBps],
        account,
      });

      setTxStatus({
        state: 'pending',
        hash,
        message: 'Transaction broadcasted. Waiting for confirmation...',
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Find SplitCreated event
      let newSplitId: bigint | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: divvyAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'SplitCreated') {
            newSplitId = (decoded.args as any).id;
            break;
          }
        } catch {
          // Ignore other event logs
        }
      }

      setTxStatus({
        state: 'success',
        hash,
        message: `Split "${splitName}" created successfully!`,
      });

      // Reset form
      setSplitName('');
      setRows([
        { address: '', percent: '50.00' },
        { address: '', percent: '50.00' },
      ]);

      fetchMySplits();

      if (newSplitId !== null) {
        window.location.hash = `#/split/${newSplitId}`;
      }
    } catch (err: any) {
      setTxStatus({ state: 'error', message: parseContractError(err) });
    } finally {
      setCreatingSplit(false);
    }
  };

  // Pay Action
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSplitId || !account) return;

    try {
      const parsedVal = parseEther(payAmountInput);
      if (parsedVal <= 0n) {
        setTxStatus({ state: 'error', message: 'Please enter an amount greater than 0 BOT' });
        return;
      }

      setPaying(true);
      setTxStatus({ state: 'pending', message: `Sending ${payAmountInput} BOT to split #${activeSplitId}...` });

      const client = getWalletClient();
      const hash = await client.writeContract({
        address: contractAddress,
        abi: divvyAbi,
        functionName: 'pay',
        args: [activeSplitId],
        value: parsedVal,
        account,
      });

      setTxStatus({
        state: 'pending',
        hash,
        message: 'Payment transaction submitted. Confirming...',
      });

      await publicClient.waitForTransactionReceipt({ hash });

      setTxStatus({
        state: 'success',
        hash,
        message: `Successfully paid ${payAmountInput} BOT into split #${activeSplitId}!`,
      });

      setPayAmountInput('0.1');
      fetchSplitDetail(activeSplitId);
      fetchMySplits();
    } catch (err: any) {
      setTxStatus({ state: 'error', message: parseContractError(err) });
    } finally {
      setPaying(false);
    }
  };

  // Withdraw Action
  const handleWithdraw = async (id: bigint) => {
    if (!account) return;

    try {
      setWithdrawing(true);
      setTxStatus({ state: 'pending', message: `Withdrawing claimable BOT from split #${id}...` });

      const client = getWalletClient();
      const hash = await client.writeContract({
        address: contractAddress,
        abi: divvyAbi,
        functionName: 'withdraw',
        args: [id],
        account,
      });

      setTxStatus({
        state: 'pending',
        hash,
        message: 'Withdrawal submitted. Confirming...',
      });

      await publicClient.waitForTransactionReceipt({ hash });

      setTxStatus({
        state: 'success',
        hash,
        message: `Withdrawal from split #${id} confirmed!`,
      });

      if (activeSplitId === id) {
        fetchSplitDetail(id);
      }
      fetchMySplits();
    } catch (err: any) {
      setTxStatus({ state: 'error', message: parseContractError(err) });
    } finally {
      setWithdrawing(false);
    }
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = lookupIdInput.trim();
    if (!clean) return;
    window.location.hash = `#/split/${clean}`;
    setLookupIdInput('');
  };

  const copyShareableLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Connected member's claimable amount on active split
  const myClaimableOnActiveSplit = useMemo(() => {
    if (!account || !splitMembers.length) return 0n;
    const found = splitMembers.find((m) => m.address.toLowerCase() === account.toLowerCase());
    return found ? found.claimable : 0n;
  }, [account, splitMembers]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <a href="#/" className="brand-section">
          <img src={appLogo} alt="Divvy Logo" className="brand-logo" />
          <div className="brand-text">
            <h1>Divvy</h1>
            <div className="brand-tagline">Everyone gets their cut.</div>
          </div>
        </a>

        <div className="header-actions">
          {account && !isCorrectChain && (
            <button className="btn btn-warning btn-sm" onClick={switchToBotTestnet}>
              Switch to BOT Testnet
            </button>
          )}

          {account ? (
            <div className="wallet-badge" title={account}>
              <span className="status-dot"></span>
              <span>{shortenAddress(account)}</span>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Network mismatch warning */}
      {account && !isCorrectChain && (
        <div className="banner banner-warning">
          <span>You are connected to an unsupported network. Please switch to <strong>BOT Testnet</strong> (Chain ID 968).</span>
          <button className="btn btn-warning btn-sm" onClick={switchToBotTestnet}>
            Switch Network
          </button>
        </div>
      )}

      {/* Transaction Status Banner */}
      {txStatus.state !== 'idle' && (
        <div className={`banner banner-${txStatus.state}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {txStatus.state === 'pending' && <span className="spinner"></span>}
            <span>{txStatus.message}</span>
            {txStatus.hash && (
              <a
                href={explorerTxUrl(txStatus.hash)}
                target="_blank"
                rel="noreferrer"
                style={{ fontWeight: 600, textDecoration: 'underline' }}
              >
                View on BohrScan ↗
              </a>
            )}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setTxStatus({ state: 'idle' })}
            style={{ padding: '0.2rem 0.6rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* VIEW: Split Detail Page */}
      {activeSplitId !== null ? (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <a href="#/" className="btn btn-secondary btn-sm">
              ← Back to all splits
            </a>
          </div>

          {loadingSplitDetail && !splitDetail && (
            <div className="card">
              <div className="empty-state">
                <div className="spinner" style={{ width: '2rem', height: '2rem', marginBottom: '1rem' }}></div>
                <p>Loading split #{activeSplitId.toString()}...</p>
              </div>
            </div>
          )}

          {splitDetailError && (
            <div className="card">
              <div className="banner banner-error" style={{ marginBottom: 0 }}>
                <span>Error loading split #{activeSplitId.toString()}: {splitDetailError}</span>
              </div>
            </div>
          )}

          {splitDetail && (
            <>
              {/* Split Hero Card */}
              <div className="card">
                <div className="split-hero">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                      <span className="badge badge-mint">Split #{splitDetail.id.toString()}</span>
                      <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{splitDetail.name}</h2>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Created by{' '}
                      <a
                        href={explorerAddressUrl(splitDetail.creator)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontFamily: 'monospace' }}
                      >
                        {shortenAddress(splitDetail.creator)}
                      </a>{' '}
                      • {formatRelativeTime(splitDetail.createdAt)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={copyShareableLink}>
                      {copiedLink ? '✓ Copied Link!' : '🔗 Copy Shareable Link'}
                    </button>
                  </div>
                </div>

                {/* Stat Grid */}
                <div className="stat-grid">
                  <div className="stat-box">
                    <div className="stat-label">Total Received</div>
                    <div className="stat-value highlight">{formatBOT(splitDetail.totalReceived)}</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Members</div>
                    <div className="stat-value">{splitMembers.length} wallets</div>
                  </div>
                  {account && (
                    <div className="stat-box">
                      <div className="stat-label">Your Claimable Share</div>
                      <div className="stat-value highlight">{formatBOT(myClaimableOnActiveSplit)}</div>
                    </div>
                  )}
                </div>

                {/* Prominent withdraw button for connected member */}
                {account && myClaimableOnActiveSplit > 0n && (
                  <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleWithdraw(splitDetail.id)}
                      disabled={withdrawing || !isCorrectChain}
                      style={{ fontSize: '1.1rem', padding: '0.85rem 2rem' }}
                    >
                      {withdrawing ? 'Withdrawing...' : `Withdraw ${formatBOT(myClaimableOnActiveSplit)}`}
                    </button>
                  </div>
                )}

                {/* Members Table */}
                <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                  Member Allocations
                </h3>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Wallet</th>
                        <th>Share %</th>
                        <th>Already Withdrawn</th>
                        <th>Claimable Now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {splitMembers.map((m) => {
                        const isYou = account && m.address.toLowerCase() === account.toLowerCase();
                        return (
                          <tr key={m.address}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <a
                                  href={explorerAddressUrl(m.address)}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontFamily: 'monospace' }}
                                >
                                  {shortenAddress(m.address)}
                                </a>
                                {isYou && <span className="badge badge-yellow">You</span>}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontWeight: 700, color: 'var(--yellow-light)' }}>
                                {formatBps(m.bps)}
                              </span>
                            </td>
                            <td>{formatBOT(m.released)}</td>
                            <td>
                              <span style={{ fontWeight: 600, color: m.claimable > 0n ? 'var(--mint-light)' : 'inherit' }}>
                                {formatBOT(m.claimable)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pay Box */}
              <div className="pay-box">
                <h3 className="card-title" style={{ color: 'var(--mint-light)' }}>
                  Send BOT to this split
                </h3>
                <p className="card-subtitle" style={{ marginBottom: '0.75rem' }}>
                  Anyone can send native BOT to this split. Members can withdraw their cut at any time.
                </p>

                <form onSubmit={handlePay}>
                  <div className="pay-input-row">
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      className="input-text"
                      style={{ maxWidth: '240px' }}
                      value={payAmountInput}
                      onChange={(e) => setPayAmountInput(e.target.value)}
                      placeholder="0.1"
                      disabled={paying}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={paying || !account || !isCorrectChain || parseFloat(payAmountInput) <= 0}
                    >
                      {paying ? 'Sending BOT...' : `Pay ${payAmountInput || '0'} BOT`}
                    </button>
                  </div>

                  <div className="quick-pills">
                    {['0.1', '0.5', '1.0', '5.0'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="btn btn-secondary btn-pill"
                        onClick={() => setPayAmountInput(preset)}
                      >
                        +{preset} BOT
                      </button>
                    ))}
                  </div>

                  <div className="note-box">
                    <strong>Important:</strong> Sending BOT directly to the Divvy contract address will fail. Payments must be sent through this page or by calling <code>pay(id)</code>.
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      ) : (
        /* VIEW: Home Page */
        <div>
          {/* Lookup Box Card */}
          <div className="card" style={{ padding: '1rem 1.5rem' }}>
            <form onSubmit={handleLookup} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Find Split by ID:
              </span>
              <input
                type="number"
                min="1"
                className="input-text"
                style={{ width: '140px', padding: '0.45rem 0.75rem' }}
                placeholder="e.g. 1"
                value={lookupIdInput}
                onChange={(e) => setLookupIdInput(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={!lookupIdInput.trim()}>
                Lookup
              </button>
            </form>
          </div>

          {/* Create a Split Card */}
          <div className="card">
            <h2 className="card-title">Create a split</h2>
            <p className="card-subtitle">
              Name your split and specify the wallet addresses and percentages. Once created, splits are permanent and immutable.
            </p>

            <form onSubmit={handleCreateSplit}>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Split Name</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {splitName.length}/50
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={50}
                  className="input-text"
                  placeholder="e.g. The Tour Band, Roommate Utilities, Dev Squad"
                  value={splitName}
                  onChange={(e) => setSplitName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Members & Percentages ({rows.length}/20)
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSplitEqually}
                    title="Divide 100% equally across all rows"
                  >
                    ⚡ Split equally
                  </button>
                </div>

                {rows.map((row, index) => {
                  const addrTrimmed = row.address.trim();
                  const isAddrValid = addrTrimmed === '' || isAddress(addrTrimmed);
                  const isSelf = account && addrTrimmed.toLowerCase() === account.toLowerCase();

                  return (
                    <div key={index} className="member-row">
                      <div>
                        <input
                          type="text"
                          className={`input-text ${!isAddrValid ? 'error' : ''}`}
                          placeholder={`0x... Member ${index + 1} address`}
                          value={row.address}
                          onChange={(e) => handleRowChange(index, 'address', e.target.value)}
                        />
                        {isSelf && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--yellow-light)', marginTop: '0.2rem', display: 'inline-block' }}>
                            (Your connected wallet)
                          </span>
                        )}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="100.00"
                            className="input-text"
                            placeholder="50.00"
                            value={row.percent}
                            onChange={(e) => handleRowChange(index, 'percent', e.target.value)}
                          />
                          <span style={{ fontWeight: 700, color: 'var(--text-dim)' }}>%</span>
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          className="btn btn-danger-outline"
                          onClick={() => handleRemoveMember(index)}
                          disabled={rows.length <= 2}
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Row Actions & Total Indicator */}
              <div className="row-actions">
                <div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddMember}
                    disabled={rows.length >= 20}
                  >
                    + Add member
                  </button>
                </div>

                <div className={`total-indicator ${isTotalValid ? 'total-valid' : 'total-invalid'}`}>
                  <span>Total: {(totalBps / 100).toFixed(2)}%</span>
                  {isTotalValid ? <span>✓</span> : <span>(Must be 100.00%)</span>}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.85rem' }}
                disabled={!isCreateFormValid || creatingSplit || !account || !isCorrectChain}
              >
                {creatingSplit ? 'Creating Split on BOT Testnet...' : 'Create Split'}
              </button>

              {!account && (
                <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Connect your wallet to create a split.
                </div>
              )}
            </form>
          </div>

          {/* "My Splits" Card */}
          <div className="card">
            <h2 className="card-title">My splits</h2>
            <p className="card-subtitle">
              Splits where your connected wallet is included as a recipient member.
            </p>

            {!account ? (
              <div className="empty-state">
                <div className="empty-icon">👛</div>
                <p>Connect your wallet to see splits you are a member of.</p>
                <button className="btn btn-primary" onClick={connectWallet} style={{ marginTop: '1rem' }}>
                  Connect Wallet
                </button>
              </div>
            ) : loadingMySplits && mySplits.length === 0 ? (
              <div className="empty-state">
                <div className="spinner" style={{ width: '2rem', height: '2rem', marginBottom: '1rem' }}></div>
                <p>Loading your splits from BOT Testnet...</p>
              </div>
            ) : mySplits.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🍰</div>
                <p>You are not a member of any splits yet.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                  Create one above or ask someone to include your wallet in their split!
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Split Name</th>
                      <th>My Share</th>
                      <th>Total Received</th>
                      <th>Claimable Now</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySplits.map((item) => (
                      <tr key={item.id.toString()}>
                        <td>
                          <span className="badge badge-mint">#{item.id.toString()}</span>
                        </td>
                        <td>
                          <a
                            href={`#/split/${item.id.toString()}`}
                            style={{ fontWeight: 700, color: 'var(--text-main)' }}
                          >
                            {item.name}
                          </a>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--yellow-light)' }}>
                            {item.myPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td>{formatBOT(item.totalReceived)}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: item.claimableNow > 0n ? 'var(--mint-light)' : 'inherit' }}>
                            {formatBOT(item.claimableNow)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {item.claimableNow > 0n && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleWithdraw(item.id)}
                                disabled={withdrawing || !isCorrectChain}
                              >
                                Withdraw
                              </button>
                            )}
                            <a href={`#/split/${item.id.toString()}`} className="btn btn-secondary btn-sm">
                              View
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
