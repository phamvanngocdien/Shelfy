import { useEffect, useState, useRef } from 'react';
import api from '../lib/api';
import Draggable from 'react-draggable';
import 'react-resizable/css/styles.css';
import { getShelbyBlobUrl } from '../lib/utils';
import { ZoomIn, ZoomOut, Trash2 } from 'lucide-react';

type FilterType = 'all' | 'frame' | 'sticker';

export interface Asset {
  _id: string;
  name: string;
  type: 'frame' | 'sticker';
  shelbyBlobName: string;
  ownerAddress: string;
  defaultWidth: number;
  defaultHeight: number;
}

export interface PlacedAsset extends Asset {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

interface Props {
  onSelect: (assets: PlacedAsset[]) => void;
  croppedPreview?: string | null;
}

export default function AssetSelector({ onSelect, croppedPreview }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [placed, setPlaced] = useState<PlacedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/assets', { params: { approved: true } }).then(({ data }) => {
      setAssets(data.assets || data);
      setLoading(false);
    });
  }, []);

  const addAsset = (asset: Asset) => {
    const newAsset: PlacedAsset = {
      ...asset,
      id: crypto.randomUUID(),
      x: 50, y: 50,
      width: asset.defaultWidth,
      height: asset.defaultHeight,
      scale: 1,
    };
    setPlaced([...placed, newAsset]);
    setSelectedId(newAsset.id);
  };

  const updatePosition = (id: string, x: number, y: number) => {
    setPlaced((prev) => prev.map((a) => (a.id === id ? { ...a, x, y } : a)));
  };

  const updateScale = (id: string, newScale: number) => {
    setPlaced((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const clampedScale = Math.max(0.2, Math.min(3, newScale));
      return {
        ...a,
        scale: clampedScale,
        width: Math.round(a.defaultWidth * clampedScale),
        height: Math.round(a.defaultHeight * clampedScale),
      };
    }));
  };

  const removeAsset = (id: string) => {
    setPlaced((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Use ref to avoid onSelect causing infinite re-render loops
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => { onSelectRef.current(placed); }, [placed]);

  const filteredAssets = assets.filter((a) => filter === 'all' || a.type === filter);
  const selectedAsset = placed.find(a => a.id === selectedId);

  if (loading) return <div className="text-center py-8">Loading assets...</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Canvas */}
      <div className="col-span-2">
        <div
          className="relative border-2 border-pink-300 dark:border-pink-600 w-[400px] h-[400px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
          onClick={() => setSelectedId(null)}
        >
          {croppedPreview && (
            <img src={croppedPreview} alt="Your PFP" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {placed.map((asset) => (
            <Draggable
              key={asset.id}
              position={{ x: asset.x, y: asset.y }}
              onStop={(e, data) => updatePosition(asset.id, data.x, data.y)}
              onMouseDown={(e) => { e.stopPropagation(); setSelectedId(asset.id); }}
            >
              <div
                className={`absolute cursor-move z-10 ${selectedId === asset.id ? 'ring-2 ring-pink-500 ring-offset-1' : ''}`}
                style={{ width: asset.width, height: asset.height }}
              >
                <img
                  src={getShelbyBlobUrl(asset.ownerAddress, asset.shelbyBlobName)}
                  alt={asset.name}
                  className="w-full h-full object-contain pointer-events-none select-none"
                />
                {selectedId === asset.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAsset(asset.id); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-lg hover:bg-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            </Draggable>
          ))}
        </div>

        {/* Scale controls — shown when an asset is selected */}
        {selectedAsset && (
          <div className="mt-3 flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 w-[400px]">
            <button
              onClick={() => updateScale(selectedAsset.id, selectedAsset.scale - 0.1)}
              className="p-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              <ZoomOut size={14} />
            </button>
            <input
              type="range"
              min="0.2" max="3" step="0.05"
              value={selectedAsset.scale}
              onChange={(e) => updateScale(selectedAsset.id, parseFloat(e.target.value))}
              className="flex-1 accent-pink-500 h-1.5"
            />
            <button
              onClick={() => updateScale(selectedAsset.id, selectedAsset.scale + 0.1)}
              className="p-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              <ZoomIn size={14} />
            </button>
            <span className="text-xs text-gray-500 w-12 text-right font-mono">{Math.round(selectedAsset.scale * 100)}%</span>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="col-span-1">
        <div className="flex gap-2 mb-2">
          {['all', 'frame', 'sticker'].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t as FilterType)}
              className={`px-2 py-1 text-xs rounded capitalize ${filter === t ? 'bg-pink-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <h3 className="font-bold mb-2">Assets Library</h3>
        <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto p-1">
          {filteredAssets.map((asset) => (
            <div
              key={asset._id}
              className="border p-2 cursor-pointer hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-gray-700 rounded transition-all"
              onClick={() => addAsset(asset)}
            >
              <img
                src={getShelbyBlobUrl(asset.ownerAddress, asset.shelbyBlobName)}
                alt={asset.name}
                className="w-full h-12 object-contain mx-auto"
              />
              <p className="text-[10px] text-center mt-1 truncate">{asset.name}</p>
            </div>
          ))}
        </div>

        {/* Placed assets list */}
        {placed.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-2">Placed ({placed.length})</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {placed.map(a => (
                <div
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition ${
                    selectedId === a.id
                      ? 'bg-pink-500/10 border border-pink-500/30 text-pink-500'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="truncate">{a.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeAsset(a.id); }}
                    className="text-red-400 hover:text-red-500 ml-1"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setPlaced([]); setSelectedId(null); }}
              className="mt-2 text-red-500 text-xs underline w-full text-center"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
