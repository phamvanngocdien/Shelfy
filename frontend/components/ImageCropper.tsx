import { useRef, useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { useToast } from '../hooks/useToast';

interface Props {
  onCrop: (blob: Blob) => void;
}

export default function ImageCropper({ onCrop }: Props) {
  const [image, setImage] = useState<File | null>(null);
  const [scale, setScale] = useState(1.2);
  const editorRef = useRef<AvatarEditor>(null);
  const toast = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return; 

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, GIF).');
      return;
    }

    const maxSize = 5 * 1024 * 1024; 
    if (file.size > maxSize) {
      toast.error('File size exceeds 5MB. Please choose a smaller image.');
      return;
    }
    setImage(file);
  };

  const handleCrop = () => {
    if (editorRef.current) {
      const canvas = editorRef.current.getImage();
      canvas.toBlob((blob) => {
        if (blob) onCrop(blob);
      }, 'image/png');
    }
  };

  return (
    <div className="space-y-4">
      {!image ? (
        <div className="border-2 border-dashed border-pink-300 dark:border-pink-600 p-8 text-center rounded-lg">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="image-upload"
          />
          <label
            htmlFor="image-upload"
            className="cursor-pointer bg-pink-500 text-white px-6 py-3 rounded-lg hover:bg-pink-600"
          >
            Choose Image
          </label>
          <p className="mt-2 text-gray-600 dark:text-gray-300">JPG, PNG, GIF (max 5MB)</p>
        </div>
      ) : (
        <div className="space-y-4 flex flex-col items-center">
          <AvatarEditor
            ref={editorRef}
            image={image}
            width={400}
            height={400}
            border={50}
            scale={scale}
            rotate={0}
            className="border-2 border-pink-300 dark:border-pink-600 rounded-lg"
          />
          <div className="w-full max-w-md">
            <label className="block text-sm font-medium mb-1">Zoom</label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <button
            onClick={handleCrop}
            className="bg-pink-500 text-white px-6 py-3 rounded-lg hover:bg-pink-600"
          >
            Crop & Continue
          </button>
        </div>
      )}
    </div>
  );
}