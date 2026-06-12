import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import api from '../lib/api';
import { socket } from '../lib/socket';
import Skeleton from '../components/Skeleton';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import { ArrowRight } from 'lucide-react';

interface PFP {
  _id: string; username: string; discord: string;
  blobName: string; imageUrl: string;
}
interface PFPResponse { pfps: PFP[]; totalPages: number; currentPage: number; }

const fetchPFPs = async (page: number, search: string): Promise<PFPResponse> => {
  const { data } = await api.get('/pfp', { params: { page, limit: 24, search } });
  return data;
};

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { page: queryPage, search: querySearch } = router.query;
  const [page, setPage] = useState(Number(queryPage) || 1);
  const [search, setSearch] = useState((querySearch as string) || '');

  const { data, isLoading, error } = useQuery({
    queryKey: ['pfps', page, search],
    queryFn: () => fetchPFPs(page, search),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (search) params.set('search', search);
    const newQuery = params.toString();
    const currentQuery = new URLSearchParams(router.asPath.split('?')[1] || '').toString();
    if (newQuery !== currentQuery) {
      router.replace({ query: newQuery }, undefined, { shallow: true });
    }
  }, [page, search]);

  useEffect(() => {
    socket.connect();
    socket.on('new-pfp', (newPfp: PFP) => {
      if (page === 1 && !search) {
        queryClient.setQueryData(['pfps', 1, ''], (old: PFPResponse | undefined) => {
          if (!old) return old;
          return { ...old, pfps: [newPfp, ...old.pfps.slice(0, 23)] };
        });
      }
    });
    return () => { socket.off('new-pfp'); socket.disconnect(); };
  }, [page, search, queryClient]);

  if (error) return <div className="text-center py-20 text-red-500">Error loading PFPs</div>;

  const recentPfps = data?.pfps?.slice(0, 8) || [];

  return (
    <div>
      {/* Hero Section */}
      {page === 1 && !search && (
        <section className="mb-12">
          <div className="flex flex-col lg:flex-row items-center gap-12 mb-10">
            {/* Left - Text */}
            <div className="flex-1">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white leading-tight mb-4">
                Build Your<br />
                <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Shelfy</span>
              </h2>
              <p className="text-gray-400 mb-8 max-w-md leading-relaxed">
                Upload your photo, customize your Shelfy, and publish it on Shelby.
              </p>
              <div className="flex gap-3">
                <Link href="/create"
                  className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-pink-500/20">
                  Create Your Shelfy
                </Link>
                <button onClick={() => { setSearch(''); setPage(1); document.getElementById('gallery-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="border border-gray-700 hover:border-gray-500 text-gray-300 px-6 py-3 rounded-xl text-sm font-medium transition-all hover:bg-white/5">
                  View Gallery
                </button>
              </div>
            </div>
            {/* Right - Featured Profile Card */}
            {recentPfps[0] && (
              <div className="flex-shrink-0">
                <div className="bg-white dark:bg-[#12121f] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 w-80 text-center">
                  <div className="relative w-64 h-64 mx-auto rounded-2xl overflow-hidden mb-4 border-2 border-gray-200 dark:border-gray-700">
                    <Image src={recentPfps[0].imageUrl} alt={recentPfps[0].username} fill className="object-cover" sizes="160px" />
                  </div>
                  <p className="text-gray-900 dark:text-white font-bold text-lg">{recentPfps[0].username}</p>
                  <p className="text-gray-500 text-sm">@{recentPfps[0].discord}</p>
                </div>
              </div>
            )}
          </div>

          {/* Recently Created */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recently Created</h3>
            <button onClick={() => document.getElementById('gallery-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-pink-400 hover:text-pink-300 text-sm flex items-center gap-1 transition">
              View Gallery <ArrowRight size={14} />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {recentPfps.map((pfp) => (
              <Link href={`/pfp/${pfp.blobName}`} key={pfp._id} className="flex-shrink-0">
                <div className="w-28 group">
                  <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 group-hover:border-pink-500/50 transition-all">
                    <Image src={pfp.imageUrl} alt={pfp.username} fill className="object-cover" sizes="112px" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Gallery Section */}
      <div id="gallery-section" className="scroll-mt-20" />
      <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} className="mb-6" />

      {isLoading && !data ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Skeleton count={24} className="aspect-square" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {data?.pfps?.map((pfp: PFP) => (
              <Link href={`/pfp/${pfp.blobName}`} key={pfp._id}>
                <div className="group bg-white dark:bg-[#12121f] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:border-pink-500/40 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-pink-500/5">
                  <div className="relative aspect-square">
                    <Image src={pfp.imageUrl} alt={pfp.username} fill sizes="(max-width: 768px) 50vw, 16vw" className="object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="font-semibold truncate text-sm text-gray-900 dark:text-white">{pfp.username}</p>
                    <p className="text-gray-500 text-xs truncate">@{pfp.discord}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <Pagination currentPage={page} totalPages={data?.totalPages || 1} onPageChange={setPage} className="mt-8" />
        </>
      )}
    </div>
  );
}
