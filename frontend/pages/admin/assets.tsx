import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAptosWallet } from '../../hooks/useAptosWallet';
import { useToast } from '../../hooks/useToast';
import api from '../../lib/api';
import { Trash2, CheckCircle, EyeOff, Eye, Package, ImageOff, Shield, RotateCcw, AlertTriangle, CheckSquare, Square, Upload, Plus } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import { batchUploadToShelby, BatchUploadResult } from '../../lib/shelbyUpload';
import { removeWhiteBackground } from '../../lib/removeWhiteBg';
import { Network } from '@aptos-labs/ts-sdk';
import { STORAGE_OPTIONS, DEFAULT_EXPIRATION_DAYS } from '../../lib/storageOptions';
import { resolveNetwork, getShelbyExplorerUrl } from '../../lib/networkUtils';
import { getAdminAuthHeaders } from '../../lib/adminAuth';

interface Asset {
  _id: string; name: string; type: string; shelbyBlobName: string;
  ownerAddress: string; defaultWidth: number; defaultHeight: number;
  uploadedBy?: string; isApproved: boolean; isDeleted?: boolean;
  deletedAt?: string; createdAt: string;
}

interface HiddenPFP {
  _id: string; username: string; blobName: string; owner: string;
  imageUrl: string; isHidden: boolean; hiddenReason?: string;
  hiddenBy?: string; createdAt: string;
}

type ModalAction = { type: 'approve' | 'delete' | 'restore' | 'unhide' | 'batch-delete-assets' | 'batch-restore-assets' | 'batch-hide-pfps' | 'batch-delete-pfps'; id: string; name: string } | null;

export default function AdminPage() {
  const { account, connected, signAndSubmitTransaction, signMessage, network } = useAptosWallet();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'assets' | 'hidden'>('assets');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetFilter, setAssetFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [assetPage, setAssetPage] = useState(1);
  const [assetTotalPages, setAssetTotalPages] = useState(1);
  const [hiddenPFPs, setHiddenPFPs] = useState<HiddenPFP[]>([]);
  const [hiddenLoading, setHiddenLoading] = useState(true);
  const [hiddenPage, setHiddenPage] = useState(1);
  const [hiddenTotalPages, setHiddenTotalPages] = useState(1);
  const [hiddenTotal, setHiddenTotal] = useState(0);
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [refetchKey, setRefetchKey] = useState(0);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [selectedPfps, setSelectedPfps] = useState<Set<string>>(new Set());
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkType, setBulkType] = useState<'sticker' | 'frame'>('sticker');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkRemoveBg, setBulkRemoveBg] = useState(true);
  const [bulkExpirationDays, setBulkExpirationDays] = useState(DEFAULT_EXPIRATION_DAYS);
  const [bulkPhase, setBulkPhase] = useState('');
  const [bulkResults, setBulkResults] = useState<BatchUploadResult[]>([]);

  const isAdmin = connected && account?.address?.toString() === process.env.NEXT_PUBLIC_ADMIN_ADDRESS;
  const walletAddr = account?.address?.toString() || '';

  const getAuthHeaders = async () => {
    if (!account?.address || !account?.publicKey || !signMessage) {
      throw new Error('Wallet not connected');
    }
    // PublicKey may be a string or a PublicKey object with toString()
    const pubKeyHex = typeof account.publicKey === 'string'
      ? account.publicKey
      : account.publicKey.toString();
    return getAdminAuthHeaders({
      address: account.address.toString(),
      signMessage,
      publicKey: pubKeyHex,
    });
  };

  const triggerRefetch = () => setRefetchKey(k => k + 1);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'assets') {
      setAssetsLoading(true);
      const isDeletedFilter = assetFilter === 'deleted';
      api.get('/assets', {
        params: {
          type: typeFilter !== 'all' ? typeFilter : undefined,
          approved: assetFilter === 'approved' ? true : assetFilter === 'pending' ? false : undefined,
          deleted: isDeletedFilter ? 'true' : 'false',
          page: assetPage, limit: 12,
        },
      }).then(res => {
        setAssets(Array.isArray(res.data.assets) ? res.data.assets : []);
        setAssetTotalPages(res.data.totalPages || 1);
        return Promise.all([
          api.get('/assets', { params: { approved: false, limit: 1 } }),
          api.get('/assets', { params: { deleted: 'true', limit: 1 } }),
        ]);
      }).then(([pendingRes, deletedRes]) => {
        setPendingCount(pendingRes.data.total || 0);
        setDeletedCount(deletedRes.data.total || 0);
      }).catch(() => setAssets([])).finally(() => setAssetsLoading(false));
    } else {
      setHiddenLoading(true);
      (async () => {
        try {
          const headers = await getAuthHeaders();
          const res = await api.get('/admin/pfp', {
            params: { filter: 'hidden', page: hiddenPage, limit: 12 },
            headers,
          });
          setHiddenPFPs(res.data.pfps || []);
          setHiddenTotalPages(res.data.totalPages || 1);
          setHiddenTotal(res.data.total || 0);
        } catch {
          setHiddenPFPs([]);
        } finally {
          setHiddenLoading(false);
        }
      })();
    }
  }, [isAdmin, activeTab, assetFilter, typeFilter, assetPage, hiddenPage, walletAddr, refetchKey]);

  const handleConfirm = async () => {
    if (!modalAction) return;
    const { type, id } = modalAction;
    setModalAction(null);
    try {
      const headers = await getAuthHeaders();
      if (type === 'approve') {
        await api.patch(`/admin/assets/${id}/approve`, {}, { headers });
        toast.success('Asset approved');
      } else if (type === 'delete') {
        await api.delete(`/admin/assets/${id}`, { headers });
        toast.success('Asset moved to trash');
      } else if (type === 'restore') {
        await api.patch(`/admin/assets/${id}/restore`, {}, { headers });
        toast.success('Asset restored');
      } else if (type === 'unhide') {
        await api.patch(`/admin/pfp/${id}/unhide`, {}, { headers });
        toast.success('PFP restored');
        setHiddenPFPs(prev => prev.filter(p => p._id !== id));
        setHiddenTotal(prev => Math.max(0, prev - 1));
      } else if (type === 'batch-delete-assets') {
        await api.post('/admin/assets/batch-delete', { ids: [...selectedAssets] }, { headers });
        toast.success(`${selectedAssets.size} assets deleted`);
        setSelectedAssets(new Set());
      } else if (type === 'batch-restore-assets') {
        await api.post('/admin/assets/batch-restore', { ids: [...selectedAssets] }, { headers });
        toast.success(`${selectedAssets.size} assets restored`);
        setSelectedAssets(new Set());
      } else if (type === 'batch-hide-pfps') {
        await api.post('/admin/pfp/batch-hide', { ids: [...selectedPfps] }, { headers });
        toast.success(`${selectedPfps.size} PFPs hidden`);
        setSelectedPfps(new Set());
      } else if (type === 'batch-delete-pfps') {
        await api.post('/admin/pfp/batch-delete', { ids: [...selectedPfps] }, { headers });
        toast.success(`${selectedPfps.size} PFPs permanently deleted`);
        setSelectedPfps(new Set());
      }
      triggerRefetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const getModalConfig = () => {
    if (!modalAction) return { title: '', message: '', variant: 'info' as const, confirmLabel: '' };
    const configs: Record<string, any> = {
      approve: { title: 'Duyệt asset', message: `Bạn có chắc chắn muốn duyệt "${modalAction.name}"?`, variant: 'info' as const, confirmLabel: 'Duyệt' },
      delete: { title: 'Xoá asset', message: `Bạn có chắc chắn muốn xoá "${modalAction.name}"? Asset sẽ được chuyển vào thùng rác và có thể khôi phục sau.`, variant: 'danger' as const, confirmLabel: 'Xoá' },
      restore: { title: 'Khôi phục asset', message: `Bạn có muốn khôi phục "${modalAction.name}" từ thùng rác?`, variant: 'warning' as const, confirmLabel: 'Khôi phục' },
      unhide: { title: 'Hiện lại PFP', message: `Bạn có muốn hiện lại PFP "${modalAction.name}"?`, variant: 'info' as const, confirmLabel: 'Hiện lại' },
      'batch-delete-assets': { title: 'Xoá hàng loạt', message: `Bạn có chắc chắn muốn xoá ${modalAction.name}?`, variant: 'danger' as const, confirmLabel: 'Xoá tất cả' },
      'batch-restore-assets': { title: 'Khôi phục hàng loạt', message: `Bạn có muốn khôi phục ${modalAction.name}?`, variant: 'warning' as const, confirmLabel: 'Khôi phục tất cả' },
      'batch-hide-pfps': { title: 'Ẩn hàng loạt', message: `Bạn có chắc chắn muốn ẩn ${modalAction.name}?`, variant: 'danger' as const, confirmLabel: 'Ẩn tất cả' },
      'batch-delete-pfps': { title: 'Xoá vĩnh viễn', message: `Bạn có chắc chắn muốn xoá vĩnh viễn ${modalAction.name}? Hành động này không thể hoàn tác.`, variant: 'danger' as const, confirmLabel: 'Xoá vĩnh viễn' },
    };
    return configs[modalAction.type] || { title: 'Xác nhận', message: `Bạn có chắc chắn muốn thực hiện thao tác này cho ${modalAction.name}?`, variant: 'warning' as const, confirmLabel: 'Xác nhận' };
  };

  const getAssetImageUrl = (asset: Asset) =>
    `${process.env.NEXT_PUBLIC_SHELBY_GATEWAY}/${asset.ownerAddress}/${asset.shelbyBlobName}`;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Shield size={48} className="text-gray-400" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-gray-500">Connect the admin wallet to access this page.</p>
      </div>
    );
  }

  const filterBtns = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending', count: pendingCount, color: 'yellow' },
    { value: 'approved', label: 'Approved' },
    { value: 'deleted', label: 'Deleted', count: deletedCount, color: 'red' },
  ];

  const modalConfig = getModalConfig();

  return (
    <div className="max-w-6xl mx-auto">
      <ConfirmModal
        isOpen={!!modalAction}
        title={modalConfig.title}
        message={modalConfig.message}
        variant={modalConfig.variant}
        confirmLabel={modalConfig.confirmLabel}
        onConfirm={handleConfirm}
        onCancel={() => setModalAction(null)}
      />

      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
          Admin Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Manage assets and moderate content</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex justify-center gap-1 mb-8 bg-gray-100 dark:bg-gray-800/50 rounded-2xl p-1.5 w-fit mx-auto">
        <button onClick={() => setActiveTab('assets')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'assets' ? 'bg-white dark:bg-gray-700 text-pink-600 dark:text-pink-300 shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}>
          <Package size={16} /> Assets
          {pendingCount > 0 && <span className="bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
        </button>
        <button onClick={() => setActiveTab('hidden')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'hidden' ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-300 shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}>
          <ImageOff size={16} /> Hidden PFPs
          {hiddenTotal > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{hiddenTotal}</span>}
        </button>
      </div>

      {/* ==================== ASSETS TAB ==================== */}
      {activeTab === 'assets' && (
        <div>
          {/* Bulk Upload Button + Panel */}
          <div className="mb-6">
            <button
              onClick={() => setShowBulkUpload(!showBulkUpload)}
              className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition mx-auto"
            >
              <Plus size={16} /> {showBulkUpload ? 'Hide Upload Panel' : 'Bulk Upload Assets'}
            </button>

            {showBulkUpload && (
              <div className="mt-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-2xl mx-auto">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Bulk Upload Assets</h3>

                {/* Type selector */}
                <div className="flex gap-3 mb-4">
                  {(['sticker', 'frame'] as const).map(t => (
                    <button key={t} onClick={() => setBulkType(t)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${bulkType === t ? 'bg-pink-500/10 border-pink-500/50 text-pink-400' : 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-500'
                        }`}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Remove bg toggle */}
                <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
                  <input type="checkbox" checked={bulkRemoveBg} onChange={e => setBulkRemoveBg(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-400 text-pink-500 focus:ring-pink-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Auto-remove white background</span>
                </label>

                {/* Storage duration */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Storage Duration</label>
                  <select value={bulkExpirationDays} onChange={e => setBulkExpirationDays(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:border-pink-500/50 outline-none transition">
                    {STORAGE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}{opt.recommended ? ' ✦' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Drop zone */}
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-pink-500/40 transition cursor-pointer"
                  onClick={() => document.getElementById('bulk-file-input')?.click()}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => {
                    e.preventDefault(); e.stopPropagation();
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                    setBulkFiles(prev => [...prev, ...files]);
                  }}
                >
                  <Upload size={32} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-500 text-sm">Drop images here or <span className="text-pink-400 underline">click to browse</span></p>
                  <p className="text-gray-600 text-xs mt-1">PNG, JPG, WEBP — multiple files supported</p>
                </div>
                <input id="bulk-file-input" type="file" accept="image/*" multiple className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files || []);
                    setBulkFiles(prev => [...prev, ...files]);
                    e.target.value = '';
                  }} />

                {/* File list */}
                {bulkFiles.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{bulkFiles.length} file(s) selected</span>
                      <button onClick={() => setBulkFiles([])} className="text-xs text-red-400 hover:text-red-500">Clear all</button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {bulkFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-1.5">
                          <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{f.name}</span>
                          <button onClick={() => setBulkFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-500 ml-2"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress */}
                {bulkUploading && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{bulkPhase}</span>
                      <span>{bulkProgress.current}/{bulkProgress.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-pink-500 h-2 rounded-full transition-all" style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}

                {/* Upload results with tx hashes */}
                {bulkResults.length > 0 && (
                  <div className="mt-4 max-h-48 overflow-y-auto space-y-1">
                    <h4 className="text-xs font-semibold text-gray-500 mb-2">Upload Results</h4>
                    {bulkResults.map((r, i) => (
                      <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${r.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        }`}>
                        <span className="truncate flex-1">{r.success ? '✓' : '✗'} {r.fileName}</span>
                        {r.success && r.blobName && account && (
                          <a href={getShelbyExplorerUrl(account.address.toString(), r.blobName)}
                            target="_blank" rel="noopener noreferrer"
                            className="ml-2 text-pink-500 hover:text-pink-400 underline flex-shrink-0">
                            View on Explorer ↗
                          </a>
                        )}
                        {r.error && <span className="ml-2 text-red-400 truncate max-w-[200px]" title={r.error}>{r.error}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                <button
                  disabled={bulkFiles.length === 0 || bulkUploading || !connected}
                  onClick={async () => {
                    if (!account) return;
                    setBulkUploading(true);
                    setBulkResults([]);
                    setBulkProgress({ current: 0, total: bulkFiles.length });
                    setBulkPhase('Preparing files...');

                    const walletNet = (typeof network === 'string' ? network : 'testnet').toLowerCase();
                    const aptosNetwork = resolveNetwork(walletNet);

                    // Pre-process all files (remove bg if needed)
                    const processedFiles = await Promise.all(
                      bulkFiles.map(async (f) => {
                        let processed: File | Blob = f;
                        if (bulkRemoveBg) {
                          try { processed = await removeWhiteBackground(f); } catch { /* keep original */ }
                        }
                        return { file: processed, fileName: f.name };
                      })
                    );

                    const phaseLabels: Record<string, string> = {
                      preparing: '🔧 Generating commitments...',
                      signing: '✍️ Sign transactions in wallet...',
                      uploading: '☁️ Uploading to Shelby Network...',
                      done: '✅ Done!',
                    };

                    const results = await batchUploadToShelby({
                      files: processedFiles,
                      owner: account.address.toString(),
                      blobPrefix: `asset_${bulkType}`,
                      expirationDays: bulkExpirationDays,
                      signAndSubmitTransaction,
                      network: aptosNetwork,
                      onProgress: (phase, current, total) => {
                        setBulkPhase(phaseLabels[phase] || phase);
                        setBulkProgress({ current, total });
                      },
                      onFileComplete: (result) => {
                        setBulkResults(prev => [...prev, result]);
                        if (result.success) {
                          toast.success(`✓ ${result.fileName} — tx: ${result.txHash.slice(0, 10)}...`);
                        } else {
                          toast.error(`✗ ${result.fileName}: ${result.error}`);
                        }
                      },
                    });

                    // Auto-register + approve successful uploads
                    for (const r of results.filter(r => r.success)) {
                      try {
                        const assetName = r.fileName.replace(/\.[^.]+$/, '');
                        const createRes = await api.post('/contribute/asset', {
                          name: assetName, type: bulkType, shelbyBlobName: r.blobName,
                          ownerAddress: account.address.toString(),
                          defaultWidth: 100, defaultHeight: 100,
                        });
                        // Use the _id from the create response directly — avoids race condition
                        const createdAsset = createRes.data;
                        if (createdAsset?._id && !createdAsset.isApproved) {
                          const approveHeaders = await getAuthHeaders();
                          await api.patch(`/admin/assets/${createdAsset._id}/approve`, {}, { headers: approveHeaders });
                        }
                      } catch { /* ignore backend errors */ }
                    }

                    const successCount = results.filter(r => r.success).length;
                    setBulkUploading(false);
                    setBulkFiles([]);
                    toast.success(`${successCount}/${bulkFiles.length} assets uploaded!`);
                    triggerRefetch();
                  }}
                  className="mt-4 w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <Upload size={16} /> {bulkUploading ? `Uploading ${bulkProgress.current}/${bulkProgress.total}...` : `Upload ${bulkFiles.length} Asset(s)`}
                </button>
              </div>
            )}
          </div>
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <div className="flex bg-gray-100 dark:bg-gray-800/50 rounded-xl p-1 gap-1">
              {filterBtns.map(f => (
                <button key={f.value} onClick={() => { setAssetFilter(f.value); setAssetPage(1); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${assetFilter === f.value
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}>
                  {f.label}
                  {f.count !== undefined && f.count > 0 && (
                    <span className={`bg-${f.color}-500 text-white text-[10px] px-1.5 py-0.5 rounded-full`}>{f.count}</span>
                  )}
                </button>
              ))}
            </div>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setAssetPage(1); }}
              className="border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs font-medium">
              <option value="all">All Types</option>
              <option value="frame">Frames</option>
              <option value="sticker">Stickers</option>
            </select>
          </div>

          {/* Batch actions bar */}
          {selectedAssets.size > 0 && (
            <div className="flex items-center justify-center gap-3 mb-6 bg-pink-500/5 border border-pink-500/20 rounded-xl p-3">
              <span className="text-sm text-pink-500 font-medium">{selectedAssets.size} selected</span>
              {assetFilter === 'deleted' ? (
                <button onClick={() => setModalAction({ type: 'batch-restore-assets', id: 'batch', name: `${selectedAssets.size} assets` })}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1">
                  <RotateCcw size={12} /> Restore All
                </button>
              ) : (
                <button onClick={() => setModalAction({ type: 'batch-delete-assets', id: 'batch', name: `${selectedAssets.size} assets` })}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1">
                  <Trash2 size={12} /> Delete All
                </button>
              )}
              <button onClick={() => setSelectedAssets(new Set())}
                className="text-gray-500 hover:text-gray-700 text-xs underline">Clear</button>
            </div>
          )}

          {/* Select all toggle */}
          {assets.length > 0 && !assetsLoading && (
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  if (selectedAssets.size === assets.length) setSelectedAssets(new Set());
                  else setSelectedAssets(new Set(assets.map(a => a._id)));
                }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
              >
                {selectedAssets.size === assets.length
                  ? <CheckSquare size={14} className="text-pink-500" />
                  : <Square size={14} />}
                {selectedAssets.size === assets.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
          )}

          {assetsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-20">
              <Package size={56} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-400 font-medium">No assets found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {assets.map((asset) => (
                <div key={asset._id}
                  className={`group bg-white dark:bg-gray-800 rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 relative ${selectedAssets.has(asset._id) ? 'ring-2 ring-pink-500' : ''
                    } ${asset.isDeleted ? 'border-red-200 dark:border-red-900 opacity-75' : 'border-gray-100 dark:border-gray-700 hover:border-pink-300 dark:hover:border-pink-700'
                    }`}>
                  {/* Selection checkbox */}
                  <button
                    onClick={() => {
                      const next = new Set(selectedAssets);
                      if (next.has(asset._id)) next.delete(asset._id);
                      else next.add(asset._id);
                      setSelectedAssets(next);
                    }}
                    className="absolute top-2.5 left-2.5 z-20 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm"
                    style={{ borderColor: selectedAssets.has(asset._id) ? '#ec4899' : '#9ca3af' }}
                  >
                    {selectedAssets.has(asset._id) && <div className="w-2.5 h-2.5 rounded-sm bg-pink-500" />}
                  </button>
                  {/* Image */}
                  <div className="relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
                    <img src={getAssetImageUrl(asset)} alt={asset.name}
                      className={`max-h-full max-w-full object-contain ${asset.isDeleted ? 'opacity-40 grayscale' : ''}`}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    {asset.isDeleted && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-red-500/90 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <Trash2 size={12} /> Deleted
                        </span>
                      </div>
                    )}
                    {/* Actions */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      {asset.isDeleted ? (
                        <button onClick={() => setModalAction({ type: 'restore', id: asset._id, name: asset.name })}
                          className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-xl shadow-lg transition" title="Restore">
                          <RotateCcw size={14} />
                        </button>
                      ) : (
                        <>
                          {!asset.isApproved && (
                            <button onClick={() => setModalAction({ type: 'approve', id: asset._id, name: asset.name })}
                              className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-xl shadow-lg transition" title="Approve">
                              <CheckCircle size={14} />
                            </button>
                          )}
                          <button onClick={() => setModalAction({ type: 'delete', id: asset._id, name: asset.name })}
                            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-xl shadow-lg transition" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-4 border-t border-gray-50 dark:border-gray-700/50">
                    <p className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{asset.name}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-xs text-gray-400 capitalize bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">{asset.type}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${asset.isDeleted ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                          : asset.isApproved ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                        {asset.isDeleted ? '🗑 Deleted' : asset.isApproved ? '✓ Approved' : '⏳ Pending'}
                      </span>
                    </div>
                    {asset.uploadedBy && (
                      <p className="text-[10px] text-gray-400 mt-3 break-all font-mono leading-tight bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                        {asset.uploadedBy}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {assetTotalPages > 1 && (
            <div className="flex justify-center mt-10 gap-3">
              <button onClick={() => setAssetPage(p => Math.max(1, p - 1))} disabled={assetPage === 1}
                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                ← Prev
              </button>
              <span className="px-4 py-2.5 text-sm text-gray-500 font-medium">{assetPage} / {assetTotalPages}</span>
              <button onClick={() => setAssetPage(p => Math.min(assetTotalPages, p + 1))} disabled={assetPage === assetTotalPages}
                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================== HIDDEN PFPs TAB ==================== */}
      {activeTab === 'hidden' && (
        <div>
          {hiddenLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
            </div>
          ) : hiddenPFPs.length === 0 ? (
            <div className="text-center py-20">
              <Eye size={56} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-400 font-medium">No hidden PFPs</p>
              <p className="text-sm text-gray-300 dark:text-gray-600 mt-1">All content is currently visible</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {hiddenPFPs.map((pfp) => (
                <div key={pfp._id} className="bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-900 overflow-hidden">
                  <div className="relative aspect-square bg-gray-100 dark:bg-gray-900">
                    <Image src={pfp.imageUrl} alt={pfp.username} fill className="object-contain opacity-40" unoptimized />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-red-500/90 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
                        <EyeOff size={12} /> Hidden
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 border-t border-red-100 dark:border-red-900">
                    <p className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{pfp.username}</p>
                    {pfp.hiddenReason && <p className="text-xs text-red-500 truncate">⚠ {pfp.hiddenReason}</p>}
                    <p className="text-xs text-gray-400">{new Date(pfp.createdAt).toLocaleDateString()}</p>
                    <button onClick={() => setModalAction({ type: 'unhide', id: pfp._id, name: pfp.username })}
                      className="w-full flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium transition">
                      <Eye size={14} /> Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hiddenTotalPages > 1 && (
            <div className="flex justify-center mt-10 gap-3">
              <button onClick={() => setHiddenPage(p => Math.max(1, p - 1))} disabled={hiddenPage === 1}
                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                ← Prev
              </button>
              <span className="px-4 py-2.5 text-sm text-gray-500 font-medium">{hiddenPage} / {hiddenTotalPages}</span>
              <button onClick={() => setHiddenPage(p => Math.min(hiddenTotalPages, p + 1))} disabled={hiddenPage === hiddenTotalPages}
                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}