'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import api, { Asset } from '@/lib/api';
import { Upload, Trash2, FileVideo, Plus, Image as ImageIcon, Search, Filter, MoreVertical, X, Play, Eye, Tag } from 'lucide-react';

export default function AssetLibrary() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [addingTagId, setAddingTagId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [editingValidityId, setEditingValidityId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (evt) => {
          if (evt.lengthComputable) {
            const fileProgress = ((i + evt.loaded / evt.total) / files.length) * 100;
            setUploadProgress(Math.round(fileProgress));
          }
        });
        xhr.addEventListener('load', () => resolve());
        xhr.addEventListener('error', () => resolve());
        xhr.open('POST', `${backendUrl}/assets`);
        xhr.send(formData);
      });
    }

    const res = await api.get('/assets');
    setAssets(res.data);
    setUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteAsset = async (id: string) => {
    if (!confirm('確定要刪除此素材嗎？這可能會影響正在播放的排程。')) return;
    try {
      await api.delete(`/assets/${id}`);
      const res = await api.get('/assets');
      setAssets(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await api.get('/assets');
      setAssets(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const updateTags = async (id: string, newTags: string[]) => {
    await api.patch(`/assets/${id}`, { tags: newTags });
    setAssets(prev => prev.map(a => a.id === id ? { ...a, tags: newTags } : a));
  };

  const updateValidity = async (id: string, validFrom: string | null, validUntil: string | null) => {
    await api.patch(`/assets/${id}`, { validFrom, validUntil });
    setAssets(prev => prev.map(a => a.id === id ? { ...a, validFrom, validUntil } as any : a));
    setEditingValidityId(null);
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    assets.forEach(a => (a as any).tags?.forEach((t: string) => set.add(t)));
    return Array.from(set).sort();
  }, [assets]);

  const filtered = useMemo(() => assets.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchTag = !filterTag || ((a as any).tags || []).includes(filterTag);
    return matchSearch && matchTag;
  }), [assets, searchQuery, filterTag]);

  useEffect(() => {
    fetchAssets();
  }, []);

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">素材媒體庫</h1>
          <p className="text-slate-500 font-medium">上傳並管理您的圖片與影片內容</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="group relative inline-flex items-center px-8 py-4 bg-[#1A5336] text-white rounded-2xl font-bold shadow-xl shadow-green-900/10 hover:bg-[#1A5336]/90 transition-all overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
            <Upload size={20} className="mr-3" />
            {uploading ? `上傳中 ${uploadProgress}% (每次處理一個檔案)` : '上傳新素材'}
          </button>

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="w-full min-w-[220px] bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-[#1A5336] rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleUpload}
          className="hidden"
          accept="image/*,video/*"
          multiple
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 py-2">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="搜尋素材名稱..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200/40 rounded-2xl shadow-sm focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-medium outline-none"
          />
        </div>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setFilterTag(prev => prev === tag ? null : tag)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold border transition-all ${filterTag === tag
              ? 'bg-[#1A5336] text-white border-[#1A5336]'
              : 'bg-white text-slate-500 border-slate-200 hover:border-[#1A5336]'
              }`}
          >
            <Tag size={11} />{tag}
          </button>
        ))}
      </div>

      <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-6 space-y-6">
        {/* Special Add Box */}
        <div className="break-inside-avoid">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-[3/4] border-2 border-dashed border-slate-200 rounded-[28px] flex flex-col items-center justify-center text-slate-400 hover:border-[#1A5336] hover:text-[#1A5336] hover:bg-green-50/30 transition-all group"
          >
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-[#1A5336]/10 group-hover:scale-110 transition-all">
              <Plus size={32} />
            </div>
            <span className="text-sm font-bold">新增媒體</span>
          </button>
        </div>

        {filtered.map((asset) => (
          <div key={asset.id} className="break-inside-avoid group bg-white border border-slate-200/60 rounded-[28px] overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1.5 transition-all duration-300 relative flex flex-col cursor-pointer">
            <div className={`relative overflow-hidden bg-slate-100 ${asset.orientation === 'PORTRAIT' ? 'aspect-[9/16]' : 'aspect-video'}`}>
              {asset.type === 'IMAGE' || asset.thumbnailUrl ? (
                <div className="relative w-full h-full">
                  <img src={asset.thumbnailUrl || asset.url} alt={asset.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  {asset.type === 'VIDEO' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30">
                        <Play size={16} fill="currentColor" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-6">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                    <FileVideo size={32} className="text-blue-400" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{asset.name.split('.').pop()} VIDEO</span>
                </div>
              )}

              {/* Type Badge */}
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-tighter rounded-full border border-white/20">
                  {asset.type === 'IMAGE' ? 'Image' : 'Video'}
                </span>
              </div>

              {/* Orientation Tag */}
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1 bg-[#1A5336]/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/10">
                  {asset.orientation === 'PORTRAIT' ? '9:16' : '16:9'}
                </span>
              </div>

              {/* Delete & Preview Overlay */}
              <div className="absolute inset-0 bg-[#1A5336]/90 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-6 translate-y-4 group-hover:translate-y-0 p-4 text-center">
                <p className="text-white text-xs font-bold leading-tight line-clamp-2 px-2 mb-2">{asset.name}</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); }}
                    className="w-14 h-14 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl flex items-center justify-center hover:bg-white hover:text-[#1A5336] hover:scale-110 active:scale-95 transition-all shadow-xl"
                  >
                    <Eye size={24} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id); }}
                    className="w-14 h-14 bg-red-500/20 backdrop-blur-md text-red-100 border border-red-500/30 rounded-2xl flex items-center justify-center hover:bg-red-600 hover:text-white hover:scale-110 active:scale-95 transition-all shadow-xl"
                  >
                    <Trash2 size={24} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <p className="text-xs font-bold text-slate-800 truncate">{asset.name}</p>
              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {((asset as any).tags || []).map((tag: string) => (
                  <span
                    key={tag}
                    onClick={() => setFilterTag(prev => prev === tag ? null : tag)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-[#1A5336]/8 text-[#1A5336] border border-[#1A5336]/15 rounded-full text-[9px] font-black uppercase tracking-tighter cursor-pointer hover:bg-[#1A5336]/20 transition-all"
                  >
                    <Tag size={8} />{tag}
                    <button
                      onClick={(e) => { e.stopPropagation(); updateTags(asset.id, ((asset as any).tags || []).filter((t: string) => t !== tag)); }}
                      className="ml-0.5 text-[#1A5336]/50 hover:text-red-500"
                    >×</button>
                  </span>
                ))}
                {addingTagId === asset.id ? (
                  <input
                    autoFocus
                    className="px-2 py-0.5 border border-[#1A5336]/30 rounded-full text-[9px] font-bold outline-none w-16 bg-white"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        const existing = (asset as any).tags || [];
                        if (!existing.includes(tagInput.trim())) updateTags(asset.id, [...existing, tagInput.trim()]);
                        setTagInput(''); setAddingTagId(null);
                      } else if (e.key === 'Escape') { setTagInput(''); setAddingTagId(null); }
                    }}
                    onBlur={() => { setTagInput(''); setAddingTagId(null); }}
                    placeholder="tag..."
                  />
                ) : (
                  <button
                    onClick={() => { setAddingTagId(asset.id); setTagInput(''); }}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-[#1A5336]/10 hover:text-[#1A5336] transition-all text-[10px] font-black"
                  >+</button>
                )}
              </div>

              {/* Validity Dates */}
              {(() => {
                const a = asset as any;
                const now = new Date();
                const isExpired = a.validUntil && now > new Date(a.validUntil);
                const notYetValid = a.validFrom && now < new Date(a.validFrom);
                return (
                  <div>
                    {editingValidityId === asset.id ? (
                      <div className="space-y-1.5">
                        {[{ label: '上架日期', key: 'validFrom' }, { label: '下架日期', key: 'validUntil' }].map(({ label, key }) => (
                          <div key={key} className="flex items-center gap-2">
                            <label className="text-[8px] font-black text-slate-400 uppercase w-14 shrink-0">{label}</label>
                            <input
                              type="date"
                              defaultValue={a[key] ? new Date(a[key]).toISOString().slice(0, 10) : ''}
                              id={`validity-${asset.id}-${key}`}
                              className="flex-1 text-[10px] font-bold px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1A5336]"
                            />
                          </div>
                        ))}
                        <div className="flex gap-1.5 mt-1">
                          <button
                            onClick={() => {
                              const fromEl = document.getElementById(`validity-${asset.id}-validFrom`) as HTMLInputElement;
                              const untilEl = document.getElementById(`validity-${asset.id}-validUntil`) as HTMLInputElement;
                              updateValidity(asset.id, fromEl.value || null, untilEl.value || null);
                            }}
                            className="flex-1 text-[9px] font-black py-1 bg-[#1A5336] text-white rounded-lg"
                          >儲存</button>
                          <button onClick={() => setEditingValidityId(null)} className="flex-1 text-[9px] font-black py-1 bg-slate-100 text-slate-500 rounded-lg">取消</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingValidityId(asset.id)}
                        className={`text-[9px] font-bold ${isExpired ? 'text-red-500' : notYetValid ? 'text-orange-400' : a.validUntil ? 'text-[#1A5336]' : 'text-slate-300'} hover:underline`}
                      >
                        {isExpired ? '⚠ 已過期' : notYetValid ? `⏳ ${new Date((a as any).validFrom).toLocaleDateString('zh-TW')} 上架` : a.validUntil ? `📅 ${new Date(a.validUntil).toLocaleDateString('zh-TW')} 下架` : '+ 設定有效期限'}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300"
          onClick={() => setPreviewAsset(null)}
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-lg"></div>
          <div
            className="relative w-full max-w-6xl aspect-video bg-black rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="absolute top-8 left-8 right-8 flex items-center justify-between z-10">
              <div className="bg-black/20 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl">
                <h3 className="text-white font-bold tracking-tight">{previewAsset.name}</h3>
              </div>
              <button
                onClick={() => setPreviewAsset(null)}
                className="w-12 h-12 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl flex items-center justify-center hover:bg-white hover:text-black transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content Display */}
            <div className="w-full h-full flex items-center justify-center">
              {previewAsset.type === 'VIDEO' ? (
                <video src={previewAsset.url} controls autoPlay className="max-w-full max-h-full" />
              ) : (
                <img src={previewAsset.url} alt={previewAsset.name} className="max-w-full max-h-full object-contain" />
              )}
            </div>

            {/* Asset Info Overlay (Bottom) */}
            <div className="absolute bottom-8 left-8 right-8 flex items-center justify-center pointer-events-none">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 px-8 py-3 rounded-full flex items-center gap-6">
                <span className="text-white/60 text-[10px] font-black uppercase tracking-widest border-r border-white/10 pr-6">
                  Type: {previewAsset.type}
                </span>
                <span className="text-white/60 text-[10px] font-black uppercase tracking-widest border-r border-white/10 pr-6">
                  Ratio: {previewAsset.orientation === 'PORTRAIT' ? '9:16' : '16:9'}
                </span>
                <span className="text-white/60 text-[10px] font-black uppercase tracking-widest">
                  Size: {(parseInt(previewAsset.size) / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
