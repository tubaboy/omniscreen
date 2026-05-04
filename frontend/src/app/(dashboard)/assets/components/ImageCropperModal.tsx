import React, { useRef, useState, useEffect } from 'react';
import { Cropper, ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { X, Crop, Monitor, Smartphone, Square, Check } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  assetName: string;
  onSave: (croppedBlob: Blob, newName: string) => Promise<void>;
}

export default function ImageCropperModal({
  isOpen,
  onClose,
  imageUrl,
  assetName,
  onSave
}: ImageCropperModalProps) {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(16 / 9);
  const [newName, setNewName] = useState(() => {
    // Generate a default "Cropped" name
    const parts = assetName.split('.');
    if (parts.length > 1) {
      const ext = parts.pop();
      return `${parts.join('.')} (cropped).${ext}`;
    }
    return `${assetName} (cropped)`;
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (cropperRef.current?.cropper) {
      cropperRef.current.cropper.setAspectRatio(aspectRatio === undefined ? NaN : aspectRatio);
    }
  }, [aspectRatio]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!cropperRef.current || !cropperRef.current.cropper) return;
    
    setIsSaving(true);
    try {
      // Get the cropped canvas
      const canvas = cropperRef.current.cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('裁切失敗，無法產生圖像檔案');
          setIsSaving(false);
          return;
        }
        
        await onSave(blob, newName);
        setIsSaving(false);
        onClose();
      }, 'image/jpeg', 0.9);
      
    } catch (err) {
      console.error('Cropping error:', err);
      alert('處理影像時發生錯誤');
      setIsSaving(false);
    }
  };

  const ratioOptions = [
    { label: '自由', value: undefined, icon: Crop },
    { label: '橫幅 (16:9)', value: 16 / 9, icon: Monitor },
    { label: '直式 (9:16)', value: 9 / 16, icon: Smartphone },
    { label: '橫幅 (4:3)', value: 4 / 3, icon: Monitor },
    { label: '直式 (3:4)', value: 3 / 4, icon: Smartphone },
    { label: '方形 (1:1)', value: 1, icon: Square },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center">
              <Crop size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">相片裁切編輯器</h2>
              <p className="text-xs font-bold text-slate-400 mt-1">選取要截取的範圍並儲存為新素材</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 bg-slate-50">
          {/* Main Cropper Area */}
          <div className="flex-1 p-6 relative flex flex-col items-center justify-center min-h-[400px]">
             <Cropper
                src={imageUrl}
                style={{ height: '100%', width: '100%' }}
                aspectRatio={aspectRatio}
                guides={true}
                viewMode={2}
                dragMode="move"
                ref={cropperRef}
                background={false}
                responsive={true}
                autoCropArea={1}
                checkOrientation={false} // Disable auto-orientation to avoid bugs
                crossOrigin="anonymous"   // Important for external / MinIO images
             />
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-80 bg-white border-l border-slate-100 p-6 flex flex-col gap-8 shrink-0 overflow-y-auto">
            
            {/* Aspect Ratios */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">裁切比例</label>
              <div className="grid grid-cols-2 gap-2">
                {ratioOptions.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => setAspectRatio(option.value)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2 ${
                      aspectRatio === option.value
                        ? 'border-violet-600 bg-violet-50 text-violet-700'
                        : 'border-slate-100 bg-white text-slate-500 hover:border-violet-200 hover:bg-slate-50'
                    }`}
                  >
                    <option.icon size={20} />
                    <span className="text-xs font-bold">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Target File Name */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 flex justify-between">
                <span>另存新檔名稱</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all"
                placeholder="輸入新素材名稱"
              />
              <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-2 rounded-lg border border-amber-100">
                ⚠️ 此操作將自動建立一個全新的素材，不會影響正在播放中原本的圖片。
              </p>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !newName.trim()}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 active:scale-95 transition-all shadow-lg shadow-violet-500/30 flex items-center gap-2 disabled:opacity-50 disabled:active:scale-100"
          >
            {isSaving ? (
              <>等候處理中...</>
            ) : (
              <><Check size={16} /> 裁切並儲存為新素材</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
