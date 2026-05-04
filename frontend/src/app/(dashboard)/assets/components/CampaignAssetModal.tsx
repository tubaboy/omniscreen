'use client';

import React, { useState, useEffect } from 'react';
import { X, Megaphone, Video, Youtube, CheckCircle, AlertCircle, Layout, Maximize2 } from 'lucide-react';
import api, { Asset } from '@/lib/api';

interface CampaignAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, config: any) => Promise<void>;
  initialData?: Asset | null;
  availableAssets: Asset[];
}

export default function CampaignAssetModal({ isOpen, onClose, onSave, initialData, availableAssets }: CampaignAssetModalProps) {
  const [name, setName] = useState('');
  const [frameAssetId, setFrameAssetId] = useState('');
  const [contentAssetId, setContentAssetId] = useState('');
  const [videoRect, setVideoRect] = useState({ top: 10, left: 10, width: 80, height: 80 });
  const [isSaving, setIsSaving] = useState(false);
  const [duration, setDuration] = useState(30);
  const [fixedDuration, setFixedDuration] = useState(true);
  const [error, setError] = useState('');

  const [isPreviewFull, setIsPreviewFull] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        try {
          const config = JSON.parse(initialData.url);
          const fAsset = availableAssets.find(a => a.url === config.frameUrl);
          const cAsset = availableAssets.find(a => a.url === config.contentUrl || a.url === config.youtubeId);
          if (fAsset) setFrameAssetId(fAsset.id);
          if (cAsset) setContentAssetId(cAsset.id);
          setVideoRect(config.videoRect || { top: 10, left: 10, width: 80, height: 80 });
          setDuration(config.duration || initialData.duration || 30);
          setFixedDuration(config.fixedDuration !== undefined ? config.fixedDuration : (initialData.fixedDuration !== undefined ? initialData.fixedDuration : true));
        } catch (e) {
          console.error('Failed to parse campaign config', e);
        }
      } else {
        setName('新活動托播素材');
        setFrameAssetId('');
        setContentAssetId('');
        setVideoRect({ top: 10, left: 10, width: 80, height: 80 });
        setFixedDuration(true);
      }
      setError('');
    }
  }, [isOpen, initialData, availableAssets]);

  const frameAsset = availableAssets.find(a => a.id === frameAssetId);
  const contentAsset = availableAssets.find(a => a.id === contentAssetId);

  const handleSave = async () => {
    if (!name.trim()) return setError('請輸入素材名稱');
    if (!frameAsset) return setError('請選擇外框圖片');
    if (!contentAsset) return setError('請選擇影片內容');

    setIsSaving(true);
    const config = {
      frameUrl: frameAsset.url,
      contentUrl: contentAsset.type === 'YOUTUBE' ? null : contentAsset.url,
      youtubeId: contentAsset.type === 'YOUTUBE' ? contentAsset.url : null,
      contentType: contentAsset.type,
      videoRect,
      duration: Number(duration),
      fixedDuration
    };

    try {
      await onSave(name, config);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || '儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRectChange = (key: string, val: number) => {
    setVideoRect(prev => {
      const next = { ...prev, [key]: val };
      if (contentAsset && (key === 'width' || key === 'height')) {
        const assetRatio = (contentAsset.width && contentAsset.height) 
          ? (contentAsset.width / contentAsset.height)
          : (contentAsset.orientation === 'PORTRAIT' ? 9/16 : (contentAsset.orientation === 'PORTRAIT_34' ? 3/4 : (contentAsset.orientation === 'LANDSCAPE_43' ? 4/3 : 16/9)));
        const frameRatio = 16/9;
        const percentRatio = assetRatio / frameRatio;

        if (key === 'width') {
          next.height = Math.round(val / percentRatio);
          if (next.height > 100) {
            next.height = 100;
            next.width = Math.round(100 * percentRatio);
          }
        } else if (key === 'height') {
          next.width = Math.round(val * percentRatio);
          if (next.width > 100) {
            next.width = 100;
            next.height = Math.round(100 / percentRatio);
          }
        }
      }
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'resize') => {
    e.preventDefault();
    const container = document.getElementById('preview-container')?.getBoundingClientRect();
    if (!container) return;
    
    if (type === 'move') setIsDragging(true);
    else setIsResizing(true);
    
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      top: videoRect.top,
      left: videoRect.left,
      width: videoRect.width,
      height: videoRect.height
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging && !isResizing) return;
      const container = document.getElementById('preview-container')?.getBoundingClientRect();
      if (!container) return;

      const dx = ((e.clientX - dragStart.x) / container.width) * 100;
      const dy = ((e.clientY - dragStart.y) / container.height) * 100;

      if (isDragging) {
        setVideoRect(prev => ({
          ...prev,
          left: Math.max(0, Math.min(100 - prev.width, dragStart.left + dx)),
          top: Math.max(0, Math.min(100 - prev.height, dragStart.top + dy))
        }));
      } else if (isResizing) {
        setVideoRect(prev => ({
          ...prev,
          width: Math.max(1, Math.min(100 - prev.left, dragStart.width + dx)),
          height: Math.max(1, Math.min(100 - prev.top, dragStart.height + dy))
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      const step = e.shiftKey ? 5 : 1;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        setVideoRect(prev => {
          if (e.key === 'ArrowUp') return { ...prev, top: Math.max(0, prev.top - step) };
          if (e.key === 'ArrowDown') return { ...prev, top: Math.min(100 - prev.height, prev.top + step) };
          if (e.key === 'ArrowLeft') return { ...prev, left: Math.max(0, prev.left - step) };
          if (e.key === 'ArrowRight') return { ...prev, left: Math.min(100 - prev.width, prev.left + step) };
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`bg-white rounded-[32px] w-full ${isPreviewFull ? 'max-w-[95vw]' : 'max-w-4xl'} shadow-2xl overflow-hidden flex flex-col max-h-[95vh] transition-all duration-300`}>
        
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
              <Megaphone size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">{initialData ? '編輯活動托播素材' : '建立活動托播素材'}</h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5">結合外框圖片與動態影片內容</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsPreviewFull(!isPreviewFull)}
              className={`p-2 rounded-full transition-colors ${isPreviewFull ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:bg-slate-100'}`}
              title={isPreviewFull ? "縮小預覽" : "放大預覽"}
            >
              <Layout size={20} />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto p-8 flex flex-col ${isPreviewFull ? 'lg:flex-col' : 'lg:flex-row'} gap-8`}>
          <div className={`${isPreviewFull ? 'w-full grid grid-cols-1 md:grid-cols-3 gap-6' : 'lg:w-1/3 space-y-6'}`}>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">素材名稱</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">外框圖片 (IMAGE)</label>
              <select
                value={frameAssetId}
                onChange={e => setFrameAssetId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
              >
                <option value="">-- 請選擇 --</option>
                {availableAssets.filter(a => a.type === 'IMAGE').map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">內容影片 (VIDEO/YT)</label>
              <select
                value={contentAssetId}
                onChange={e => {
                  setContentAssetId(e.target.value);
                  const asset = availableAssets.find(a => a.id === e.target.value);
                  if (asset && asset.duration) setDuration(asset.duration);
                }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
              >
                <option value="">-- 請選擇 --</option>
                {availableAssets.filter(a => a.type === 'VIDEO' || a.type === 'YOUTUBE').map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className={`space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 ${isPreviewFull ? 'col-span-1' : ''}`}>
               <div className="flex items-center justify-between cursor-pointer" onClick={() => setFixedDuration(!fixedDuration)}>
                  <div>
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">固定播放秒數</label>
                    <p className="text-[9px] text-slate-400 font-bold leading-tight">開啟後將依照下方秒數強制切換</p>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-all relative ${fixedDuration ? 'bg-amber-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow transition-all ${fixedDuration ? 'left-6' : 'left-1'}`} />
                  </div>
               </div>
               {fixedDuration && (
                 <div className="space-y-2 pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">播放時長 (秒)</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={e => setDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700"
                    />
                 </div>
               )}
            </div>

            <div className={`space-y-4 pt-4 border-t border-slate-100 ${isPreviewFull ? 'col-span-2' : ''}`}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">播放區域比例設定</label>
                <div className="flex gap-2">
                  {['16:9', '9:16', '4:3', '3:4'].map(r => (
                    <button key={r} onClick={() => {
                      const [w, h] = r.split(':').map(Number);
                      const assetRatio = w / h;
                      const frameRatio = 16/9;
                      const percentRatio = assetRatio / frameRatio;
                      setVideoRect(prev => ({ ...prev, height: Math.round(prev.width / percentRatio) }));
                    }} className="text-[9px] font-black bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600">
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`grid ${isPreviewFull ? 'grid-cols-4' : 'grid-cols-2'} gap-4`}>
                {[
                  { key: 'top', label: '上 (T)', color: 'text-rose-500' },
                  { key: 'left', label: '左 (L)', color: 'text-indigo-500' },
                  { key: 'width', label: '寬 (W)', color: 'text-emerald-500' },
                  { key: 'height', label: '高 (H)', color: 'text-amber-500' },
                ].map(s => (
                  <div key={s.key} className="space-y-1">
                    <div className="flex justify-between text-[9px] font-black uppercase">
                      <span className={s.color}>{s.label}</span>
                      <span>{(videoRect as any)[s.key]}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={(videoRect as any)[s.key]}
                      onChange={e => handleRectChange(s.key, parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">實時預覽區</label>
                  <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200">
                    💡 可直接用滑鼠拖曳/縮放藍色區域，或用方向鍵微調
                  </span>
                </div>
                <button 
                  onClick={() => setVideoRect({ top: 0, left: 0, width: 100, height: 100 })}
                  className="text-[9px] font-black text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                >
                  重置滿版
                </button>
             </div>
             
             <div 
                id="preview-container"
                className={`relative aspect-video w-full bg-slate-900 rounded-[24px] overflow-hidden border border-slate-200 shadow-inner group transition-all duration-500 ${isPreviewFull ? 'max-h-[65vh]' : ''}`}
             >
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                
                {frameAsset ? (
                  <img src={frameAsset.url} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" alt="frame preview" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-700 bg-slate-100 font-bold text-xs">
                     請先選擇外框圖片以利對位
                  </div>
                )}

                <div 
                  onMouseDown={(e) => handleMouseDown(e, 'move')}
                  className={`absolute bg-blue-500/40 border-2 border-blue-400 flex items-center justify-center backdrop-blur-[1px] transition-all duration-150 shadow-xl cursor-move z-0 group/box ${isDragging ? 'scale-[1.01] ring-4 ring-blue-400/20' : ''}`}
                  style={{
                    top: `${videoRect.top}%`,
                    left: `${videoRect.left}%`,
                    width: `${videoRect.width}%`,
                    height: `${videoRect.height}%`
                  }}
                >
                  <div className="flex flex-col items-center gap-2 text-blue-100 drop-shadow-md pointer-events-none">
                    {contentAsset ? (
                      <>
                        {contentAsset.type === 'VIDEO' ? <Video size={isPreviewFull ? 48 : 24} /> : <Youtube size={isPreviewFull ? 48 : 24} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{contentAsset.name}</span>
                      </>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest">內容預留區</span>
                    )}
                  </div>

                  <div 
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMouseDown(e, 'resize');
                    }}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-blue-500/80 cursor-nwse-resize flex items-center justify-center rounded-tl-xl hover:bg-blue-600 transition-colors opacity-0 group-hover/box:opacity-100"
                  >
                    <Maximize2 size={16} className="text-white" />
                  </div>
                  
                  {(isDragging || isResizing) && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-3 py-1.5 rounded-lg font-mono whitespace-nowrap z-50 shadow-xl border border-white/20">
                      POS: {videoRect.left.toFixed(1)}%, {videoRect.top.toFixed(1)}% | SIZE: {videoRect.width.toFixed(1)}% x {videoRect.height.toFixed(1)}%
                    </div>
                  )}
                </div>
             </div>
             
             <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-medium italic">
                  * 藍色區域預設在圖層最底層，方便對齊外框去背位置
                </p>
                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold">
                    <AlertCircle size={12} />
                    {error}
                  </div>
                )}
             </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !frameAsset || !contentAsset}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 transition-all shadow-lg shadow-amber-500/25 flex items-center gap-2 disabled:opacity-50"
          >
            <CheckCircle size={15} />
            {isSaving ? '儲存中...' : (initialData ? '儲存變更' : '建立複合素材')}
          </button>
        </div>

      </div>
    </div>
  );
}
