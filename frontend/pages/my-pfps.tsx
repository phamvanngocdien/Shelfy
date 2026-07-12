import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAptosWallet } from '../hooks/useAptosWallet';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '../lib/api';
import Skeleton from '../components/Skeleton';
import Pagination from '../components/Pagination';
import { getShelbyBlobUrl } from '../lib/utils';
import { Wallet, Grid3X3, List, Search } from 'lucide-react';

interface PFP {
  _id: string; username: string; discord: string;
  blobName: string; imageUrl: string; owner: string; createdAt?: string;
}
interface PFPResponse { pfps: PFP[]; totalPages: number; currentPage: number; total?: number; }

const fetchMyPFPs = async (address: string, page: number): Promise<PFPResponse> => {
  const { data } = await api.get('/pfp', { params: { owner: address, page, limit: 24 } });
  return data;
};

export default function MyPFPsPage() {
  const { account, connected } = useAptosWallet();
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [localSearch, setLocalSearch] = useState('');
  const walletAddress = account?.address?.toString() || '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['myPfps', walletAddress, page],
    queryFn: () => fetchMyPFPs(walletAddress, page),
    enabled: !!walletAddress && connected,
    placeholderData: keepPreviousData,
  });

  const totalCount = data?.pfps?.length || 0;
  const filteredPfps = data?.pfps?.filter(p =>
    p.username.toLowerCase().includes(localSearch.toLowerCase()) ||
    p.discord.toLowerCase().includes(localSearch.toLowerCase())
  ) || [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Shelfy</h1>
          <p className="text-gray-500 text-sm mt-1">Manage all your published Shelfy profiles.</p>
        </div>
        {connected && (
          <Link href="/create"
            className="bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-pink-500/20 w-fit">
            Create New
          </Link>
        )}
      </div>

      {!connected ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Wallet size={48} className="text-gray-600" />
          <p className="text-gray-500 font-medium">Please connect your wallet to view your PFPs</p>
        </div>
      ) : (
        <>
          {/* Tabs + Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex gap-1 bg-gray-100 dark:bg-[#12121f] rounded-xl p-1">
              <button className="px-4 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#1a1a2e] text-gray-900 dark:text-white shadow-sm">
                All ({totalCount})
              </button>
              <button className="px-4 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
                Published ({totalCount})
              </button>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="text" placeholder="Search..." value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="bg-white dark:bg-[#12121f] border border-gray-300 dark:border-gray-800 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-800 dark:text-gray-300 w-40 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 outline-none transition" />
              </div>
              {/* View toggle */}
              <div className="flex bg-gray-100 dark:bg-[#12121f] rounded-lg p-1 gap-0.5">
                <button onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white dark:bg-[#1a1a2e] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  <Grid3X3 size={14} />
                </button>
                <button onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white dark:bg-[#1a1a2e] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Skeleton count={12} className="aspect-square rounded-xl" />
            </div>
          )}

          {error && <p className="text-red-500 text-center py-10">Error loading PFPs</p>}

          {data && filteredPfps.length === 0 && !isLoading && (
            <div className="text-center py-16">
              <p className="text-gray-500 mb-4">
                {localSearch ? 'No matching profiles found.' : "You haven't created any PFPs yet."}
              </p>
              {!localSearch && (
                <Link href="/create"
                  className="bg-pink-500 text-white px-6 py-3 rounded-xl hover:bg-pink-600 inline-block font-medium transition">
                  Create one now
                </Link>
              )}
            </div>
          )}

          {filteredPfps.length > 0 && (
            <>
              <div className={viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4'
                : 'flex flex-col gap-3'
              }>
                {filteredPfps.map((pfp: PFP) => (
                  <Link href={`/pfp/${pfp.blobName}`} key={pfp._id}>
                    {viewMode === 'grid' ? (
                      <div className="group bg-white dark:bg-[#12121f] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:border-pink-500/40 transition-all duration-200 hover:-translate-y-1">
                        <div className="relative aspect-square">
                          <Image src={getShelbyBlobUrl(pfp.owner, pfp.blobName)} alt={pfp.username} fill sizes="16vw" className="object-cover" />
                        </div>
                        <div className="p-3">
                          <p className="font-semibold truncate text-sm text-gray-900 dark:text-white">{pfp.username}</p>
                          <p className="text-gray-500 text-xs truncate">@{pfp.discord}</p>
                          {pfp.createdAt && (
                            <p className="text-gray-600 text-[10px] mt-1">Updated {new Date(pfp.createdAt).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 bg-white dark:bg-[#12121f] border border-gray-200 dark:border-gray-800 rounded-xl p-3 hover:border-pink-500/40 transition-all">
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                          <Image src={getShelbyBlobUrl(pfp.owner, pfp.blobName)} alt={pfp.username} fill className="object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{pfp.username}</p>
                          <p className="text-gray-500 text-xs">@{pfp.discord}</p>
                        </div>
                        {pfp.createdAt && (
                          <p className="text-gray-600 text-xs">{new Date(pfp.createdAt).toLocaleDateString()}</p>
                        )}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
              <Pagination currentPage={page} totalPages={data?.totalPages || 1} onPageChange={setPage} className="mt-8" />
            </>
          )}
        </>
      )}
    </div>
  );
}
