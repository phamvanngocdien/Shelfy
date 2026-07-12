import { useRouter } from 'next/router';
import { useState } from 'react';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saveAs } from 'file-saver';
import { EyeOff, Eye, Download, Share2 } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { useAptosWallet } from '../../hooks/useAptosWallet';
import { getShelbyBlobUrl } from '../../lib/utils';
import Skeleton from '../../components/Skeleton';

interface PFPDetail {
  _id: string;
  username: string;
  discord: string;
  blobName: string;
  imageUrl: string;
  owner: string;
  isHidden?: boolean;
  hiddenReason?: string;
  createdAt: string;
}

const fetchPFP = async (blobName: string): Promise<PFPDetail> => {
  const { data } = await api.get(`/pfp/${blobName}`);
  return data;
};

export default function PFPDetailPage() {
  const router = useRouter();
  const { blobName } = router.query;
  const toast = useToast();
  const queryClient = useQueryClient();
  const { account } = useAptosWallet();
  const [hideReason, setHideReason] = useState('');
  const [showHideModal, setShowHideModal] = useState(false);

  const isAdmin = account?.address?.toString() === process.env.NEXT_PUBLIC_ADMIN_ADDRESS;

  /** Simple admin headers — only sends wallet address, no signature needed */
  const getAdminHeaders = () => {
    if (!account?.address) {
      throw new Error('Wallet not connected');
    }
    return { 'x-wallet-address': account.address.toString() };
  };

  const { data: pfp, isPending: isPfpLoading, error } = useQuery({
    queryKey: ['pfp', blobName],
    queryFn: () => fetchPFP(blobName as string),
    enabled: !!blobName,
  });

  // Admin: hide PFP — no signature needed
  const hideMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const headers = getAdminHeaders();
      await api.patch(`/admin/pfp/${id}/hide`, { reason }, { headers });
    },
    onSuccess: () => {
      toast.success('PFP hidden');
      setShowHideModal(false);
      setHideReason('');
      queryClient.invalidateQueries({ queryKey: ['pfp', blobName] });
    },
    onError: () => toast.error('Failed to hide PFP'),
  });

  // Admin: unhide PFP
  const unhideMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = getAdminHeaders();
      await api.patch(`/admin/pfp/${id}/unhide`, {}, { headers });
    },
    onSuccess: () => {
      toast.success('PFP restored');
      queryClient.invalidateQueries({ queryKey: ['pfp', blobName] });
    },
    onError: () => toast.error('Failed to restore PFP'),
  });

  const handleDownload = async () => {
    if (!pfp) return;
    const toastId = toast.loading('Downloading...');
    try {
      const response = await fetch(getShelbyBlobUrl(pfp.owner, pfp.blobName));
      const blob = await response.blob();
      saveAs(blob, `${pfp.username}.png`);
      toast.update(toastId, 'Downloaded!', 'success');
    } catch {
      toast.update(toastId, 'Download failed', 'error');
    }
  };

  if (isPfpLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <Skeleton count={1} className="w-full h-96 rounded-2xl" />
      </div>
    );
  }

  if (error || !pfp) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <EyeOff size={48} className="text-gray-300" />
        <h1 className="text-2xl font-bold">Shelfy not found</h1>
        <p className="text-gray-500 text-sm">This content may have been removed</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Hidden banner */}
      {pfp.isHidden && (
        <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-4 mb-6 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <EyeOff size={20} className="text-red-500" />
            <div>
              <p className="font-bold text-red-500 text-sm">Content Hidden</p>
              {pfp.hiddenReason && <p className="text-xs text-red-400 mt-0.5">{pfp.hiddenReason}</p>}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => unhideMutation.mutate(pfp._id)}
              disabled={unhideMutation.isPending}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              <Eye size={14} />
              Restore
            </button>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-pink-200 dark:border-pink-800 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-lg">
          <Image
            src={getShelbyBlobUrl(pfp.owner, pfp.blobName)}
            alt={pfp.username}
            fill
            className="object-contain"
            priority
            unoptimized
          />
        </div>

        {/* Details */}
        <div className="space-y-5">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            {pfp.username}
          </h1>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <span className="text-sm font-medium">Discord:</span>
              <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-sm">{pfp.discord}</span>
            </div>
            <p className="text-sm text-gray-400">
              Created: {new Date(pfp.createdAt).toLocaleDateString()}
            </p>
            <div className="text-sm text-gray-400 font-mono">
              <span className="text-gray-500 font-sans">Owner:</span>{' '}
              <span className="break-all text-xs">{pfp.owner}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
            >
              <Download size={18} />
              Download PNG
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Link copied!');
              }}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-pink-400 text-pink-500 px-6 py-3 rounded-xl font-bold hover:bg-pink-50 dark:hover:bg-gray-800 transition-all"
            >
              <Share2 size={18} />
              Share
            </button>
          </div>

          {/* Admin: Hide button */}
          {isAdmin && !pfp.isHidden && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Admin</p>
              <button
                onClick={() => setShowHideModal(true)}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all border border-red-300 dark:border-red-800"
              >
                <EyeOff size={16} />
                Hide this Shelfy
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hide Modal */}
      {showHideModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <EyeOff size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold">Hide this Shelfy?</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This will hide the PFP from public view. The image still exists on Shelby Network
              but won&apos;t be shown on the website. You can restore it anytime from the Admin panel.
            </p>
            <input
              type="text"
              placeholder="Reason (e.g. Inappropriate content)"
              value={hideReason}
              onChange={(e) => setHideReason(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-red-400 transition"
            />
            <div className="flex gap-3">
              <button
                onClick={() => hideMutation.mutate({ id: pfp._id, reason: hideReason })}
                disabled={hideMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-medium transition disabled:opacity-50"
              >
                {hideMutation.isPending ? 'Hiding...' : 'Confirm Hide'}
              </button>
              <button
                onClick={() => { setShowHideModal(false); setHideReason(''); }}
                className="flex-1 border border-gray-200 dark:border-gray-600 py-2.5 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
