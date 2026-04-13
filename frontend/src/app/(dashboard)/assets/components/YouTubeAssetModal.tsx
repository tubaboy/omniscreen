'use client';

import React, { useState } from 'react';
import { X, Youtube, Link, CheckCircle, AlertCircle } from 'lucide-react';

interface YouTubeAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, url: string) => Promise<void>;
  initialData?: { name: string; url: string } | null;
}

// Extract YouTube video ID and return a preview thumbnail URL
function parseYouTubeId(raw: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function YouTubeAssetModal({ isOpen, onClose, onSave, initialData }: YouTubeAssetModalProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setUrl(initialData?.url || '');
      setName(initialData?.name || '');
      setError('');
    } else {
      setUrl('');
      setName('');
      setError('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const videoId = parseYouTubeId(url.trim());
  const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  const handleUrlChange = (val: string) => {
    setUrl(val);
    setError('');
    const id = parseYouTubeId(val.trim());
    if (id && !name) {
      // Auto fill name from URL if empty
      setName(`YouTube 影片`);
    }
  };

  const handleSave = async () => {
    if (!videoId) {
      setError('無法解析 YouTube 影片 ID，請確認網址格式。');
      return;
    }
    if (!name.trim()) {
      setError('請輸入素材名稱。');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(name.trim(), url.trim());
      setUrl('');
      setName('');
      setError('');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '儲存失敗，請再試一次。';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
              <Youtube size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">{initialData ? '編輯 YouTube 素材' : '新增 YouTube 素材'}</h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5">輕量嵌入，直接播放 YouTube 影片</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">YouTube 網址 / 影片 ID</label>
            <div className="relative">
              <Link size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white transition-all"
              />
            </div>
            {/* Inline validation indicator */}
            {url && (
              <div className={`flex items-center gap-1.5 text-xs font-bold ${videoId ? 'text-emerald-600' : 'text-amber-500'}`}>
                {videoId ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {videoId ? `✓ 影片 ID：${videoId}` : '尚未識別到有效的影片 ID'}
              </div>
            )}
          </div>

          {/* Preview Card */}
          {thumbUrl && (
            <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl} alt="YouTube thumbnail" className="w-full object-cover aspect-video" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-2xl opacity-90">
                    <div className="w-0 h-0 border-t-[9px] border-b-[9px] border-l-[18px] border-transparent border-l-white ml-1" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Name Input */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">素材名稱</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="輸入顯示名稱"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white transition-all"
            />
          </div>

          {/* Notes */}
          <p className="text-[11px] text-slate-400 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
            💡 一般影片會播放至結束後自動切換。若為<strong className="text-red-500">直播影片</strong>，系統會自動偵測並依排程中設定的秒數切換。
          </p>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 font-bold bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <AlertCircle size={13} /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !videoId || !name.trim()}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-500/25 flex items-center gap-2 disabled:opacity-50 disabled:active:scale-100"
          >
            <Youtube size={15} />
            {isSaving ? '儲存中...' : (initialData ? '儲存變更' : '新增 YouTube 素材')}
          </button>
        </div>
      </div>
    </div>
  );
}
