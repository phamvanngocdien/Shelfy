import { useState } from 'react';
import { useAptosWallet } from '../hooks/useAptosWallet';
import { useToast } from '../hooks/useToast';
import api from '../lib/api';
import { uploadToShelby } from '../lib/shelbyUpload';
import SpecialButton from '../components/SpecialButton';
import { Upload, Frame, Sticker, Layers, Award } from 'lucide-react';
import { removeWhiteBackground } from '../lib/removeWhiteBg';
import { STORAGE_OPTIONS, DEFAULT_EXPIRATION_DAYS } from '../lib/storageOptions';
import { resolveNetwork } from '../lib/networkUtils';

const MAX_FILE_SIZE = 1 * 1024 * 1024;

export default function ContributePage() {
  const { account, connected, signAndSubmitTransaction, network } = useAptosWallet();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<'frame' | 'sticker'>('sticker');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [defaultWidth, setDefaultWidth] = useState(100);
  const [defaultHeight, setDefaultHeight] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [expirationDays, setExpirationDays] = useState(DEFAULT_EXPIRATION_DAYS);
  const [autoRemoveBg, setAutoRemoveBg] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > MAX_FILE_SIZE) { toast.error('File size must be less than 1MB'); return; }
      if (!selectedFile.type.startsWith('image/')) { toast.error('Only image files are allowed'); return; }
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !file) { toast.error('Please fill all required fields'); return; }
    if (!connected || !account) { toast.error('Please connect your wallet to upload assets'); return; }

    setSubmitting(true);
    const toastId = toast.loading('Processing asset...');
    try {
      let processedFile: File | Blob = file;
      if (autoRemoveBg) {
        toast.update(toastId, 'Removing white background...', 'loading');
        processedFile = await removeWhiteBackground(file);
      }
      toast.update(toastId, 'Uploading to Shelby Network...', 'loading');
      const shelbyBlobName = await uploadToShelby({
        file: processedFile, owner: account.address.toString(), blobPrefix: `asset_${type}`,
        expirationDays, signAndSubmitTransaction, network: resolveNetwork(network),
      });
      await api.post('/contribute/asset', {
        name, type, shelbyBlobName, ownerAddress: account.address.toString(),
        defaultWidth, defaultHeight, userAddress: account.address.toString(),
      });
      toast.update(toastId, 'Asset uploaded! It will appear after admin approval.', 'success');
      setName(''); setFile(null); setPreviewUrl(null);
    } catch (err: any) {
      toast.update(toastId, err.response?.data?.error || err.message || 'Upload failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const assetTypes = [
    { icon: Frame, title: 'Frames', desc: 'Add new frames for others to use.', color: 'text-blue-400' },
    { icon: Sticker, title: 'Stickers', desc: 'Create stickers to express more.', color: 'text-pink-400' },
    { icon: Layers, title: 'Backgrounds', desc: 'Share backgrounds and patterns.', color: 'text-purple-400' },
    { icon: Award, title: 'Badges', desc: 'Design badges and icons.', color: 'text-amber-400' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contribute to Shelfy</h1>
        <p className="text-gray-500 text-sm mt-1">Submit your creative assets and help build the future of Shelfy.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Submit Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#12121f] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Submit Your Assets</h2>
              <span className="bg-pink-500/20 text-pink-400 text-[10px] font-bold px-2 py-0.5 rounded-full">New</span>
            </div>

            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Share your original assets with the Shelfy community.<br />
              Your assets may be featured in the gallery!
            </p>

            {!connected && (
              <div className="mb-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                <p className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">
                  ⚠️ Please connect your wallet to upload assets.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Asset Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0a0a14] border border-gray-300 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 outline-none transition"
                  placeholder="Enter asset name" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type *</label>
                <div className="flex gap-3">
                  {(['sticker', 'frame'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setType(t)}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${type === t ? 'bg-pink-500/10 border-pink-500/50 text-pink-400' : 'bg-gray-50 dark:bg-[#0a0a14] border-gray-300 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-600'
                        }`}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Width (px)</label>
                  <input type="number" value={defaultWidth} onChange={(e) => setDefaultWidth(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-[#0a0a14] border border-gray-300 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 focus:border-pink-500/50 outline-none transition" min="1" max="2000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Height (px)</label>
                  <input type="number" value={defaultHeight} onChange={(e) => setDefaultHeight(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-[#0a0a14] border border-gray-300 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 focus:border-pink-500/50 outline-none transition" min="1" max="2000" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Storage Duration</label>
                <select value={expirationDays} onChange={(e) => setExpirationDays(Number(e.target.value))}
                  className="w-full bg-gray-50 dark:bg-[#0a0a14] border border-gray-300 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 focus:border-pink-500/50 outline-none transition">
                  {STORAGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}{opt.recommended ? ' ✦' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Image * (PNG, max 1MB)</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 text-center hover:border-pink-500/30 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('file-input')?.click()}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="max-h-32 mx-auto object-contain rounded-lg" />
                  ) : (
                    <>
                      <Upload size={32} className="mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-500 text-sm">Drag & drop your photo here</p>
                      <p className="text-gray-600 text-xs mt-1">or <span className="text-pink-400 underline">click to browse</span></p>
                      <p className="text-gray-700 text-xs mt-2">JPG, PNG or WEBP. Max 1MB.</p>
                    </>
                  )}
                </div>
                <input id="file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />
                <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRemoveBg}
                    onChange={(e) => setAutoRemoveBg(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-400 text-pink-500 focus:ring-pink-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Auto-remove white background</span>
                </label>
              </div>

              <SpecialButton
                title={submitting ? 'Uploading to Shelby...' : 'Submit Assets'}
                height="3rem" disabled={submitting || !connected} type="submit"
              />
            </form>
          </div>
        </div>

        {/* Asset Types */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#12121f] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sticky top-20">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Supported Asset Types</h3>
            <div className="space-y-5">
              {assetTypes.map((at) => (
                <div key={at.title} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 ${at.color}`}>
                    <at.icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{at.title}</p>
                    <p className="text-xs text-gray-500">{at.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}