import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAptosWallet } from '../hooks/useAptosWallet';
import { useToast } from '../hooks/useToast';
import api from '../lib/api';
import { getShelbyBlobUrl } from '../lib/utils';
import { uploadToShelby } from '../lib/shelbyUpload';
import { Network } from '@aptos-labs/ts-sdk';
import ImageCropper from '../components/ImageCropper';
import AssetSelector, { PlacedAsset } from '../components/AssetSelector';
import SpecialButton from '../components/SpecialButton';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { STORAGE_OPTIONS, DEFAULT_EXPIRATION_DAYS } from '../lib/storageOptions';
import { resolveNetwork } from '../lib/networkUtils';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

async function composeImage(baseBlob: Blob, assets: PlacedAsset[]): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;

  const baseUrl = URL.createObjectURL(baseBlob);
  try {
    const baseImg = await loadImage(baseUrl);
    ctx.drawImage(baseImg, 0, 0, 400, 400);
  } finally {
    URL.revokeObjectURL(baseUrl);
  }

  for (const asset of assets) {
    try {
      const assetUrl = getShelbyBlobUrl(asset.ownerAddress, asset.shelbyBlobName);
      const assetImg = await loadImage(assetUrl);
      ctx.drawImage(assetImg, asset.x, asset.y, asset.width, asset.height);
    } catch (err) {
      console.warn(`Failed to load asset "${asset.name}", skipping`, err);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to compose image'));
      },
      'image/png'
    );
  });
}

export default function CreatePage() {
  const router = useRouter();
  const { account, connected, signAndSubmitTransaction, network } = useAptosWallet();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [assetsData, setAssetsData] = useState<PlacedAsset[]>([]);
  const [username, setUsername] = useState('');
  const [discord, setDiscord] = useState('');
  const [discordError, setDiscordError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expirationDays, setExpirationDays] = useState(DEFAULT_EXPIRATION_DAYS);

  const validateDiscord = (value: string) => /^[a-z0-9._]{2,32}$/.test(value.toLowerCase());

  const handleDiscordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase();
    setDiscord(val);
    setDiscordError(validateDiscord(val) ? '' : 'Discord handle must be 2-32 chars, only a-z, 0-9, . and _');
  };

  const handleCrop = (blob: Blob) => {
    setCroppedBlob(blob);
    const url = URL.createObjectURL(blob);
    setCroppedPreview(url);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!connected || !account) {
      toast.error('Please connect your wallet first');
      return;
    }
    if (!croppedBlob || !username || !discord || discordError) {
      toast.error('Please complete all fields correctly');
      return;
    }

    setSubmitting(true);
    let toastId = toast.loading('Composing final image...');

    try {
      toastId = toast.update(toastId, 'Merging image with decorations...', 'loading');
      const finalBlob = await composeImage(croppedBlob, assetsData);

      toastId = toast.update(toastId, 'Uploading to Shelby Network...', 'loading');
      const walletNet = (typeof network === 'string' ? network : 'testnet').toLowerCase();
      const aptosNetwork = resolveNetwork(walletNet);

      const blobName = await uploadToShelby({
        file: finalBlob,
        owner: account.address.toString(),
        blobPrefix: 'shelfy',
        expirationDays,
        signAndSubmitTransaction,
        network: aptosNetwork,
      });

      const formattedAssets = assetsData.map(asset => ({
        assetId: asset._id,
        x: asset.x,
        y: asset.y,
        width: asset.width,
        height: asset.height
      }));

      await api.post('/pfp', {
        username,
        discord: discord.toLowerCase(),
        blobName,
        owner: account.address.toString(),
        assets: formattedAssets,
      });

      toast.dismiss(); // dismiss all loading toasts
      toast.success('PFP created successfully!');
      router.push(`/pfp/${blobName}`);
    } catch (err: any) {
      console.error(err);
      toast.dismiss(); // dismiss ALL lingering loading toasts
      toast.error(err.response?.data?.error || 'Failed to create PFP');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Make Your Shelfy</h1>

      {/* Progress bar */}
      <div className="flex mb-8 gap-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex-1">
            <div className={`h-2 rounded-full transition-colors ${step >= i ? 'bg-pink-500' : 'bg-gray-300 dark:bg-gray-700'}`} />
            <p className="text-sm mt-1 text-center">
              {i === 1 ? 'Crop' : i === 2 ? 'Decorate' : i === 3 ? 'Info' : 'Upload'}
            </p>
          </div>
        ))}
      </div>

      {/* Step 1: Crop */}
      {step === 1 && (
        <div>
          <ImageCropper onCrop={handleCrop} />
        </div>
      )}

      {/* Step 2: Decorate (optional) */}
      {step === 2 && (
        <div>
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Add frames and stickers to your PFP, or skip this step if you prefer it clean.
            </p>
          </div>
          <AssetSelector onSelect={(assets: PlacedAsset[]) => setAssetsData(assets)} croppedPreview={croppedPreview} initialAssets={assetsData} />
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white transition"
            >
              <ArrowLeft size={16} /> Back to Crop
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1 bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600 transition"
            >
              {assetsData.length === 0 ? 'Skip' : 'Next'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Info */}
      {step === 3 && (
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
            {/* Show preview thumbnail with decorations */}
            {croppedPreview && (
              <div className="flex justify-center mb-2">
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-pink-500">
                  <img src={croppedPreview} alt="Your PFP" className="absolute inset-0 w-full h-full object-cover" />
                  {assetsData.map((a) => (
                    <img key={a.id} src={getShelbyBlobUrl(a.ownerAddress, a.shelbyBlobName)} alt={a.name}
                      style={{
                        position: 'absolute',
                        left: `${(a.x / 400) * 100}%`,
                        top: `${(a.y / 400) * 100}%`,
                        width: `${(a.width / 400) * 100}%`,
                        height: `${(a.height / 400) * 100}%`,
                        pointerEvents: 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block font-medium mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={50}
                className="border rounded px-4 py-2 w-full bg-white dark:bg-gray-700"
                placeholder="Your display name (max 50)"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Discord handle</label>
              <input
                type="text"
                value={discord}
                onChange={handleDiscordChange}
                className="border rounded px-4 py-2 w-full bg-white dark:bg-gray-700"
                placeholder="e.g. username123"
              />
              {discordError && <p className="text-red-500 text-sm mt-1">{discordError}</p>}
            </div>
            <div>
              <label className="block font-medium mb-1">Storage duration (days)</label>
              <select
                value={expirationDays}
                onChange={(e) => setExpirationDays(Number(e.target.value))}
                className="border rounded px-4 py-2 w-full bg-white dark:bg-gray-700"
              >
                {STORAGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}{opt.recommended ? ' ✦' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Longer duration costs more APT and ShelbyUSD</p>
            </div>
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg border border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white transition"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!username || !discord || !!discordError}
                className="flex items-center gap-1 bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600 transition disabled:opacity-50"
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Confirm & Upload */}
      {step === 4 && (
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
            <h2 className="text-xl font-bold">Confirm Upload</h2>
            {croppedPreview && (
              <div className="flex justify-center mb-2">
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-pink-500">
                  <img src={croppedPreview} alt="Your PFP" className="absolute inset-0 w-full h-full object-cover" />
                  {assetsData.map((a) => (
                    <img key={a.id} src={getShelbyBlobUrl(a.ownerAddress, a.shelbyBlobName)} alt={a.name}
                      style={{
                        position: 'absolute',
                        left: `${(a.x / 400) * 100}%`,
                        top: `${(a.y / 400) * 100}%`,
                        width: `${(a.width / 400) * 100}%`,
                        height: `${(a.height / 400) * 100}%`,
                        pointerEvents: 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1 text-sm">
              <p><strong>Username:</strong> {username}</p>
              <p><strong>Discord:</strong> {discord}</p>
              <p><strong>Decorations:</strong> {assetsData.length}</p>
              <p><strong>Storage:</strong> {expirationDays} days</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm text-blue-800 dark:text-blue-200">
              ✨ Your PFP image will be <strong>composed</strong> (base image + all decorations merged) before uploading to Shelby Network.
            </div>
            {!connected && <p className="text-yellow-500 text-sm">Please connect your wallet to proceed.</p>}
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg border border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white transition"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <SpecialButton
                title={submitting ? 'Composing & Uploading...' : 'Upload to Shelby'}
                height="2.5rem"
                disabled={submitting || !connected}
                onClick={handleSubmit}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
