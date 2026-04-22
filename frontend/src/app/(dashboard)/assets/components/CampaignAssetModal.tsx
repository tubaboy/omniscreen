'use client';

import React, { useState, useEffect } from 'react';
import { X, Megaphone, Image as ImageIcon, Video, Youtube, CheckCircle, AlertCircle, Layout, Maximize2 } from 'lucide-react';
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
  const [error, setError] = useState('');

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
        } catch (e) {
          console.error('Failed to parse campaign config', e);
        }
      } else {
        setName('新活動托播素材');
        setFrameAssetId('');
        setContentAssetId('');
        setVideoRect({ top: 10, left: 10, width: 80, height: 80 });
      }
      setError('');
    }
  }, [isOpen, initialData, availableAssets]);

  if (!isOpen) return null;

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
      contentType: contentAsset.type, // VIDEO or YOUTUBE
      videoRect,
      duration: Number(duration)
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

      // 等比例調整邏輯
      if (contentAsset && (key === 'width' || key === 'height')) {
        // 取得素材原始比例，預設 16:9 或 9:16
        const assetRatio = (contentAsset.width && contentAsset.height) 
          ? (contentAsset.width / contentAsset.height)
          : (contentAsset.orientation === 'PORTRAIT' ? 9/16 : 16/9);
        
        // 預覽容器固定為 16:9
        const frameRatio = 16/9;
        
        // 百分比比例 = (素材寬/素材高) / (容器寬/容器高)
        const percentRatio = assetRatio / frameRatio;

        if (key === 'width') {
          next.height = Math.round(val / percentRatio);
          // 防止超出範圍
          if (next.height > 100) {
            next.height = 100;
            next.width = Math.round(100 * percentRatio);
          }
        } else if (key === 'height') {
          next.width = Math.round(val * percentRatio);
          // 防止超出範圍
          if (next.width > 100) {
            next.width = 100;
            next.height = Math.round(100 / percentRatio);
          }
        }
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
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
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-8">
          
          {/* Left Side: Settings */}
          <div className="lg:w-1/3 space-y-6">
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">選擇外框圖片 (IMAGE)</label>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">選擇內容影片 (VIDEO / YOUTUBE)</label>
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
                  <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">播放時長 (秒)</label>
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
                min="1"
              />
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">影片播放區域 (Rect)</label>
                <div className="flex gap-2">
                  <button onClick={() => {
                    const ratio = 16/9;
                    const frameRatio = 16/9;
                    const percentRatio = ratio / frameRatio;
                    setVideoRect(prev => ({ ...prev, height: Math.round(prev.width / percentRatio) }));
                  }} className="text-[9px] font-black bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600 transition-colors tracking-tight">16:9</button>
                  <button onClick={() => {
                    const ratio = 9/16;
                    const frameRatio = 16/9;
                    const percentRatio = ratio / frameRatio;
                    setVideoRect(prev => ({ ...prev, height: Math.round(prev.width / percentRatio) }));
                  }} className="text-[9px] font-black bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600 transition-colors tracking-tight">9:16</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'top', label: '上 (Top)', color: 'text-rose-500' },
                  { key: 'left', label: '左 (Left)', color: 'text-indigo-500' },
                  { key: 'width', label: '寬 (Width)', color: 'text-emerald-500' },
                  { key: 'height', label: '高 (Height)', color: 'text-amber-500' },
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

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>

          {/* Right Side: Preview */}
          <div className="flex-1 flex flex-col gap-4">
             <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">實時預覽</label>
                <button 
                  onClick={() => setVideoRect({ top: 0, left: 0, width: 100, height: 100 })}
                  className="text-[9px] font-black text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                >
                  重置滿版
                </button>
             </div>
             <div className="relative aspect-video w-full bg-slate-900 rounded-[24px] overflow-hidden border border-slate-200 shadow-inner group">
                
                {frameAsset ? (
                  <img src={frameAsset.url} className="absolute inset-0 w-full h-full object-cover" alt="frame preview" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-700 bg-slate-100 font-bold text-xs">
                     請選擇外框圖片
                  </div>
                )}

                <div 
                  className="absolute bg-blue-500/30 border-2 border-blue-400 flex items-center justify-center backdrop-blur-[1px] transition-all duration-150 shadow-xl"
                  style={{
                    top: `${videoRect.top}%`,
                    left: `${videoRect.left}%`,
                    width: `${videoRect.width}%`,
                    height: `${videoRect.height}%`
                  }}
                >
                  <div className="flex flex-col items-center gap-2 text-blue-100 drop-shadow-md">
                    {contentAsset ? (
                      <>
                        {contentAsset.type === 'VIDEO' ? <Video size={24} /> : <Youtube size={24} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{contentAsset.name}</span>
                      </>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest">內容預留區</span>
                    )}
                  </div>
                </div>
             </div>
             <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
               * 預覽圖僅供參考位置。實際播放時影片將在此藍色區域內呈現。時長將以影片實際長度為準。
             </p>
          </div>

        </div>

        {/* Footer */}
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
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 transition-all shadow-lg shadow-amber-500/25 flex items-center gap-2 disabled:opacity-50 disabled:active:scale-100"
          >
            <CheckCircle size={15} />
            {isSaving ? '儲存中...' : (initialData ? '儲存變更' : '建立複合素材')}
          </button>
        </div>

      </div>
    </div>
  );
}
