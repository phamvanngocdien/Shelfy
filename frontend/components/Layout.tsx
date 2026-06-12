import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';
import ConnectWallet from './ConnectWallet';
import ThemeToggle from './ThemeToggle';
import { cn } from '../lib/utils';
import { useAptosWallet } from '../hooks/useAptosWallet';
import { Shield } from 'lucide-react';

function NetworkBadge() {
  const { network, connected } = useAptosWallet();
  if (!connected) return null;
  let networkName = (typeof network === 'string' ? network : 'unknown').toLowerCase();
  if (networkName === 'custom') networkName = 'shelbynet';
  const colorMap: Record<string, string> = {
    mainnet: 'bg-green-500', testnet: 'bg-yellow-500',
    devnet: 'bg-blue-500', shelbynet: 'bg-purple-500',
  };
  const dotColor = colorMap[networkName] || 'bg-gray-400';
  const label = networkName.charAt(0).toUpperCase() + networkName.slice(1);
  return (
    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#1a1a2e] border border-gray-300 dark:border-gray-700 rounded-full px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300">
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      {label}
    </div>
  );
}

interface LayoutProps { children: ReactNode; }

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { account, connected } = useAptosWallet();
  const isAdminWallet = connected && account?.address?.toString() === process.env.NEXT_PUBLIC_ADMIN_ADDRESS;

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/create', label: 'Create' },
    { href: '/my-pfps', label: 'My Shelfy' },
    { href: '/contribute', label: 'Contribute' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a14] text-gray-900 dark:text-gray-100 transition-colors relative overflow-x-hidden">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#0d0d1a]/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800/50">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">S</div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">Shelfy Gallery</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}
                  className={cn(
                    'relative px-3 py-1.5 text-sm transition-colors',
                    router.pathname === item.href
                      ? 'text-pink-500 dark:text-pink-400 font-medium'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  )}>
                  {item.label}
                  {router.pathname === item.href && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-pink-500 rounded-full" />
                  )}
                </Link>
              ))}
              {isAdminWallet && (
                <Link href="/admin/assets"
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 text-sm transition-colors',
                    router.pathname.startsWith('/admin')
                      ? 'text-amber-500 font-medium' : 'text-amber-500/60 hover:text-amber-500'
                  )}>
                  <Shield size={13} /> Admin
                </Link>
              )}
            </nav>
          </div>

          {/* Right: Network + Wallet + Theme */}
          <div className="flex items-center gap-2">
            <NetworkBadge />
            <ConnectWallet />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 pt-20 pb-8 min-h-[calc(100vh-120px)]">
        {children}
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800/50 py-4 flex justify-center items-center gap-2 text-gray-500 text-xs">
        <img src="/images/shelby-logo.png" alt="Shelfy" width={20} height={20} className="h-5 w-auto dark:invert opacity-60" />
        <span>Stored by</span>
        <a href="https://shelby.xyz" target="_blank" rel="noopener noreferrer"
          className="text-pink-500 dark:text-pink-400 hover:text-pink-400 dark:hover:text-pink-300 transition">
          Shelby Network
        </a>
      </footer>
    </div>
  );
}