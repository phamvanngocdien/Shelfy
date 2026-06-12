import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAptosWallet } from '../hooks/useAptosWallet';
import { useToast } from '../hooks/useToast';
import SpecialButton from './SpecialButton';

export default function ConnectWallet() {
  const { connect, disconnect, account, connected, network, wallets, balance, isLoadingBalance } = useAptosWallet();
  const toast = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnectWallet = async (walletName: string) => {
    setShowWalletModal(false);
    setIsConnecting(true);
    const toastId = toast.loading(`Connecting to ${walletName}...`);
    try {
      await connect(walletName);
      toast.update(toastId, 'Connected successfully', 'success');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to connect wallet';
      toast.update(toastId, msg, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const toastId = toast.loading('Disconnecting...');
    try {
      await disconnect();
      toast.update(toastId, 'Disconnected successfully', 'success');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to disconnect wallet';
      toast.update(toastId, msg, 'error');
    }
  };

  const shortenAddress = (addr?: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';




  if (!connected) {
    return (
      <>
        <SpecialButton
          title={isConnecting ? 'Connecting...' : 'Connect Wallet'}
          height="1.75rem"
          disabled={isConnecting}
          onClick={() => setShowWalletModal(true)}
        />

        {showWalletModal && mounted && createPortal(
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-[320px] shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-center dark:text-white">Select Wallet</h3>
              <div className="flex flex-col gap-3">
                {wallets?.map((wallet) => (
                  <button
                    key={wallet.name}
                    onClick={() => handleConnectWallet(wallet.name)}
                    className="flex items-center gap-3 p-3 border dark:border-gray-600 rounded-lg hover:bg-pink-50 dark:hover:bg-gray-700 transition duration-200"
                  >
                    <img src={wallet.icon} alt={wallet.name} className="w-8 h-8 rounded" />
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{wallet.name}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowWalletModal(false)}
                className="mt-6 text-sm text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 w-full text-center font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        className="md:hidden w-7 h-7 bg-gray-100 dark:bg-[#1a1a2e] border border-gray-300 dark:border-gray-700 rounded-full flex items-center justify-center"
        aria-label="Open wallet details"
      >
        <img src="/images/wallet.svg" alt="wallet" className="w-4 h-4" />
      </button>

      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setIsDrawerOpen(false)} />
      )}

      <div
        className={`
          fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0d0d1a] p-4 rounded-t-2xl z-50 transition-transform duration-300
          md:static md:bg-transparent md:p-0 md:rounded-none md:flex md:items-center md:gap-2 md:dark:bg-transparent
          ${isDrawerOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
        `}
      >


        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#1a1a2e] border border-gray-300 dark:border-gray-700 rounded-full px-3 py-1.5 mb-2 md:mb-0 whitespace-nowrap">
          <span className="text-gray-700 dark:text-gray-300 text-xs font-medium">
            {isLoadingBalance ? '...' : balance.shd.toFixed(4)} <span className="text-gray-400 dark:text-gray-500">SHELBY</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#1a1a2e] border border-gray-300 dark:border-gray-700 rounded-full px-3 py-1.5 mb-2 md:mb-0 whitespace-nowrap">
          <span className="text-gray-700 dark:text-gray-300 text-xs font-medium">
            {isLoadingBalance ? '...' : balance.apt.toFixed(4)} <span className="text-gray-400 dark:text-gray-500">APT</span>
          </span>
        </div>

        <button
          onClick={() => {
            if (account?.address) {
              navigator.clipboard.writeText(account.address.toString());
              toast.success('Address copied!');
            }
          }}
          className="bg-gray-100 dark:bg-[#1a1a2e] border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full text-xs block mb-2 md:mb-0 transition-colors font-mono whitespace-nowrap"
          title="Copy Address"
        >
          {shortenAddress(account?.address?.toString())}
        </button>

        <button
          onClick={handleDisconnect}
          className="bg-red-500 text-white w-7 h-7 rounded flex items-center justify-center"
          title="Disconnect"
        >
          <img src="/images/logout.svg" alt="disconnect" className="w-4 h-4 invert" />
        </button>
      </div>
    </div>
  );
}