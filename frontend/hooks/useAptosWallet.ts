import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useToast } from './useToast';
import { SHD_TOKEN_ADDRESS } from '../lib/contracts';

const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000;

export function useAptosWallet() {
  const { connect, disconnect, account, connected, network, wallets, signMessage, signAndSubmitTransaction, changeNetwork } = useWallet();
  const toast = useToast();
  const [balance, setBalance] = useState({ apt: 0, shd: 0 });
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Derive the actual network name from the wallet
  const walletNetworkName = (network?.name || 'testnet').toLowerCase();

  // Create Aptos client based on the wallet's actual network
  const aptos = useMemo(() => {
    let aptosNetwork: Network;
    switch (walletNetworkName) {
      case 'mainnet': aptosNetwork = Network.MAINNET; break;
      case 'devnet': aptosNetwork = Network.DEVNET; break;
      case 'shelbynet': aptosNetwork = Network.SHELBYNET; break;
      default: aptosNetwork = Network.TESTNET; break;
    }
    return new Aptos(new AptosConfig({ network: aptosNetwork }));
  }, [walletNetworkName]);

  // Reset balance immediately when network changes
  useEffect(() => {
    setBalance({ apt: 0, shd: 0 });
  }, [walletNetworkName]);

  // Get the SHD token address for the current network
  const shdToken = SHD_TOKEN_ADDRESS[walletNetworkName] || '';

  const fetchBalances = useCallback(async () => {
    if (!account) return;
    setIsLoadingBalance(true);

    let aptVal = 0;
    let shdVal = 0;

    try {
      // Primary: fetch all coins at once
      const coins = await aptos.getAccountCoinsData({
        accountAddress: account.address.toString(),
      });

      const aptCoin = coins.find(c => c.asset_type === '0x1::aptos_coin::AptosCoin');
      aptVal = aptCoin ? Number(aptCoin.amount) / 1e8 : 0;

      if (shdToken) {
        const shdCoin = coins.find(c => c.asset_type === shdToken);
        shdVal = shdCoin ? Number(shdCoin.amount) / 1e8 : 0;
      }
    } catch (err) {
      console.warn(`getAccountCoinsData failed on ${walletNetworkName}, trying fallback...`);

      // Fallback: fetch APT balance directly (more reliable for new accounts)
      try {
        const amount = await aptos.getAccountAPTAmount({
          accountAddress: account.address.toString(),
        });
        aptVal = Number(amount) / 1e8;
      } catch {
        // Account truly doesn't exist on this network
        aptVal = 0;
      }
    }

    setBalance({
      apt: isNaN(aptVal) ? 0 : aptVal,
      shd: isNaN(shdVal) ? 0 : shdVal,
    });
    setIsLoadingBalance(false);
  }, [account, aptos, walletNetworkName, shdToken]);

  useEffect(() => {
    if (!connected || !account) {
      localStorage.removeItem('walletLoginTime');
      return;
    }

    const loginTime = localStorage.getItem('walletLoginTime');
    const now = Date.now();

    if (!loginTime) {
      localStorage.setItem('walletLoginTime', now.toString());
    } else {
      const elapsed = now - parseInt(loginTime, 10);
      if (elapsed >= SESSION_TIMEOUT_MS) {
        disconnect();
        toast.custom('Please reconnect your wallet.');
        return;
      }
    }

    const timeRemaining = SESSION_TIMEOUT_MS - (now - parseInt(localStorage.getItem('walletLoginTime') || now.toString()));

    if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
    disconnectTimerRef.current = setTimeout(() => {
      disconnect();
      toast.custom('Session expired. Please reconnect your wallet.');
      localStorage.removeItem('walletLoginTime');
    }, timeRemaining);

    return () => {
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
    };
  }, [connected, account, disconnect, toast]);

  useEffect(() => {
    if (connected && account) {
      fetchBalances();
    } else {
      setBalance({ apt: 0, shd: 0 });
    }
  }, [connected, account, refreshTrigger, fetchBalances]);

  const refreshBalance = useCallback(() => setRefreshTrigger(prev => prev + 1), []);

  const availableWallets = {
    petra: wallets?.find(w => w.name === 'Petra'),
    martian: wallets?.find(w => w.name === 'Martian'),
    pontem: wallets?.find(w => w.name === 'Pontem'),
  };

  return {
    connect,
    disconnect,
    account,
    connected,
    network: network?.name || 'unknown',
    changeNetwork,
    signMessage,
    signAndSubmitTransaction,
    balance,
    isLoadingBalance,
    refreshBalance,
    wallets,
    availableWallets,
  };
}
