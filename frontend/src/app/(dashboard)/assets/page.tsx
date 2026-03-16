'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import api, { Asset } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Upload, Trash2, FileVideo, Plus, Image as ImageIcon, Search, X, Play, Eye, Tag, BarChart3, Zap, Clock, CloudSun, Megaphone, Edit3 } from 'lucide-react';

type WidgetType = 'DASHBOARD';

interface WidgetFormState {
  name: string;
  widgetType: WidgetType;
  // Clock
  showDate: boolean;
  showSeconds: boolean;
  // Weather
  lat: string;
  lon: string;
  city: string;
  // Announcement
  title: string;
  content: string;
  scrolling: boolean;
  bgColor: string;
  textColor: string;
  contentType: 'manual' | 'news';
  newsUrl: string;
  marqueeSpeed: number;
}

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
  const router = useRouter();

  // Widget Modal State
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState<any | null>(null);
  const [widgetSaving, setWidgetSaving] = useState(false); // Kept this state
  const [widgetForm, setWidgetForm] = useState<WidgetFormState>({
    name: '',
    widgetType: 'DASHBOARD', // Added widgetType
    showDate: true,
    showSeconds: true,
    lat: '25.04',
    lon: '121.51',
    city: '台北市',
    title: '焦點公告',
    content: '',
    scrolling: true,
    bgColor: '#0f172a',
    textColor: '#ffffff',
    contentType: 'manual',
    newsUrl: 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    marqueeSpeed: 40,
  });

  // URL Modal State
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [editingUrlAsset, setEditingUrlAsset] = useState<any | null>(null);
  const [urlSaving, setUrlSaving] = useState(false);
  const [urlForm, setUrlForm] = useState({ name: '', url: '' });


  const openWidgetModal = () => {
    setEditingWidget(null);
    setWidgetForm({
      name: '我的動態看板', // Default name for new widget
      widgetType: 'DASHBOARD',
      showDate: true,
      showSeconds: true,
      lat: '25.04',
      lon: '121.51',
      city: '台北市',
      title: '焦點公告',
      content: '歡迎使用新版高質感動態看板！✨', // Default content for new widget
      scrolling: true,
      bgColor: '#0f172a',
      textColor: '#ffffff',
      contentType: 'manual',
      newsUrl: 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
      marqueeSpeed: 40,
    });
    setShowWidgetModal(true);
  };

  const openEditWidgetModal = (asset: any) => {
    let config: any = {};
    try {
      const parsed = JSON.parse(asset.url);
      config = parsed.config || {};
    } catch (e) {
      console.error('Failed to parse widget config', e);
    }

    setEditingWidget(asset);
    setWidgetForm({
      name: asset.name,
      widgetType: 'DASHBOARD', // Assuming all widgets are DASHBOARD for now
      showDate: config.showDate ?? true,
      showSeconds: config.showSeconds ?? true,
      lat: (config.lat ?? 25.04).toString(),
      lon: (config.lon ?? 121.51).toString(),
      city: config.city ?? '台北市',
      title: config.title ?? '焦點公告',
      content: config.content ?? '',
      scrolling: config.scrolling ?? true,
      bgColor: config.bgColor ?? '#0f172a',
      textColor: config.textColor ?? '#ffffff',
      contentType: config.contentType ?? 'manual',
      newsUrl: config.newsUrl ?? 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
      marqueeSpeed: config.marqueeSpeed ?? 40,
    });
    setShowWidgetModal(true);
  };

  const handleWidgetSubmit = async () => {
    if (!widgetForm.name.trim()) return alert('請輸入名稱');
    setWidgetSaving(true); // Use the existing widgetSaving state

    const payload = {
      name: widgetForm.name,
      widgetType: widgetForm.widgetType,
      duration: 30, // Default fallback, scheduling will override
      config: {
        showDate: widgetForm.showDate,
        showSeconds: widgetForm.showSeconds,
        lat: parseFloat(widgetForm.lat as string), // Ensure lat/lon are numbers
        lon: parseFloat(widgetForm.lon as string),
        city: widgetForm.city,
        title: widgetForm.title,
        content: widgetForm.content,
        scrolling: widgetForm.scrolling,
        bgColor: widgetForm.bgColor,
        textColor: widgetForm.textColor,
        contentType: widgetForm.contentType,
        newsUrl: widgetForm.newsUrl,
        marqueeSpeed: widgetForm.marqueeSpeed,
      }
    };

    try {
      if (editingWidget) {
        // Update mode
        const res = await api.patch(`/assets/${editingWidget.id}`, payload);
        setAssets(prev => prev.map(a => a.id === editingWidget.id ? res.data : a));
      } else {
        // Create mode
        const res = await api.post('/assets/widget', payload);
        setAssets(prev => [res.data, ...prev]);
      }
      setShowWidgetModal(false);
    } catch (err) {
      console.error(err);
      alert('儲存失敗');
    } finally {
      setWidgetSaving(false);
    }
  };
  
  const openUrlModal = () => {
    setEditingUrlAsset(null);
    setUrlForm({ name: '', url: '' });
    setShowUrlModal(true);
  };

  const openEditUrlModal = (asset: any) => {
    setEditingUrlAsset(asset);
    setUrlForm({ name: asset.name, url: asset.url });
    setShowUrlModal(true);
  };

  const handleUrlSubmit = async () => {
    if (!urlForm.name.trim() || !urlForm.url.trim()) return alert('請輸入名稱與網址');
    setUrlSaving(true);
    try {
      if (editingUrlAsset) {
        const res = await api.patch(`/assets/${editingUrlAsset.id}`, urlForm);
        setAssets(prev => prev.map(a => a.id === editingUrlAsset.id ? res.data : a));
      } else {
        const res = await api.post('/assets/url', urlForm);
        setAssets(prev => [res.data, ...prev]);
      }
      setShowUrlModal(false);
      setUrlForm({ name: '', url: '' });
    } catch (err) {
      console.error(err);
      alert('儲存失敗');
    } finally {
      setUrlSaving(false);
    }
  };


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
          <p className="text-slate-500 font-medium">上傳圖片影片，或新增即時動態看板 Widget</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-3">
            {/* Widget Button */}
            <button
              onClick={openWidgetModal}
              className="group relative inline-flex items-center gap-2 px-6 py-4 bg-violet-600 text-white rounded-2xl font-bold shadow-xl shadow-violet-900/20 hover:bg-violet-700 transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <Zap size={18} />
              建立動態看板
            </button>
            {/* URL Button */}
            <button
              onClick={openUrlModal}
              className="group relative inline-flex items-center gap-2 px-6 py-4 bg-sky-600 text-white rounded-2xl font-bold shadow-xl shadow-sky-900/20 hover:bg-sky-700 transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <CloudSun size={18} />
              新增網頁/URL
            </button>
            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="group relative inline-flex items-center px-6 py-4 bg-[#1A5336] text-white rounded-2xl font-bold shadow-xl shadow-green-900/10 hover:bg-[#1A5336]/90 transition-all overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <Upload size={18} className="mr-2" />
              {uploading ? `上傳中 ${uploadProgress}%` : '上傳新素材'}
            </button>
          </div>

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

        {filtered.map((asset) => {
          // ─── Widget Card ───────────────────────────────────────
          if (asset.type === 'WIDGET') {
            return (
              <div key={asset.id} className="break-inside-avoid group bg-slate-900 border border-slate-700 rounded-[28px] overflow-hidden hover:shadow-2xl hover:shadow-violet-500/30 hover:-translate-y-1.5 transition-all duration-300 relative flex flex-col cursor-pointer">
                <div className="relative overflow-hidden aspect-video bg-black flex flex-col items-center justify-center gap-2 p-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600/40 via-blue-900/40 to-emerald-600/40 opacity-80 blur-xl pointer-events-none" />
                  <span style={{ fontSize: 40 }} className="relative z-10 drop-shadow-2xl">🪄</span>
                  <span className="text-white font-black text-sm relative z-10 tracking-widest">DASHBOARD</span>
                  <div className="absolute inset-0 bg-violet-900/80 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-4">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditWidgetModal(asset); }}
                        className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 hover:bg-white/30 transition-all font-bold text-xs flex items-center gap-2"
                      >
                        <Edit3 size={14} /> 編輯
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id); }}
                        className="bg-red-500/20 backdrop-blur-md text-red-200 px-4 py-2 rounded-xl border border-red-500/20 hover:bg-red-500/40 transition-all font-bold text-xs"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-white/5 border-t border-white/10">
                  <p className="text-xs font-bold text-white truncate">{asset.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">{asset.duration ?? 10}秒 顯示</p>
                </div>
              </div>
            );
          }

          // ─── Web/URL Card ───────────────────────────────────────
          if (asset.type === 'WEB') {
            return (
              <div key={asset.id} className="break-inside-avoid group bg-slate-100 border border-slate-200 rounded-[28px] overflow-hidden hover:shadow-2xl hover:shadow-sky-500/30 hover:-translate-y-1.5 transition-all duration-300 relative flex flex-col cursor-pointer">
                <div className="relative overflow-hidden aspect-video bg-white flex flex-col items-center justify-center gap-2 p-4">
                  {asset.thumbnailUrl ? (
                    <img src={asset.thumbnailUrl} alt={asset.name} className="w-16 h-16 object-contain" />
                  ) : (
                    <span style={{ fontSize: 40 }} className="relative z-10 drop-shadow-2xl">🌐</span>
                  )}
                  <span className="text-slate-900 font-black text-[10px] relative z-10 tracking-widest uppercase truncate max-w-full px-2">{new URL(asset.url).hostname}</span>
                  <div className="absolute inset-0 bg-sky-900/80 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-4">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditUrlModal(asset); }}
                        className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 hover:bg-white/30 transition-all font-bold text-xs flex items-center gap-2"
                      >
                        <Edit3 size={14} /> 編輯
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id); }}
                        className="bg-red-500/20 backdrop-blur-md text-red-200 px-4 py-2 rounded-xl border border-red-500/20 hover:bg-red-500/40 transition-all font-bold text-xs"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-white border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-800 truncate">{asset.name}</p>
                </div>
              </div>
            );
          }

          // ─── Media Card (IMAGE / VIDEO) ────────────────────────
          return (
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
                    <FileVideo size={32} className="text-blue-400 mb-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{asset.name.split('.').pop()} VIDEO</span>
                  </div>
                )}

                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-tighter rounded-full border border-white/20">
                    {asset.type === 'IMAGE' ? 'Image' : 'Video'}
                  </span>
                </div>

                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-[#1A5336]/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/10">
                    {asset.orientation === 'PORTRAIT' ? '9:16' : '16:9'}
                  </span>
                </div>

                <div className="absolute inset-0 bg-[#1A5336]/90 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-6 translate-y-4 group-hover:translate-y-0 p-4 text-center">
                  <p className="text-white text-xs font-bold leading-tight line-clamp-2 px-2 mb-2">{asset.name}</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); }}
                      className="w-12 h-12 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl flex items-center justify-center hover:bg-white hover:text-[#1A5336] hover:scale-110 active:scale-95 transition-all shadow-xl"
                    >
                      <Eye size={20} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/analytics/assets/${asset.id}`); }}
                      className="w-12 h-12 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 hover:scale-110 active:scale-95 transition-all shadow-xl"
                    >
                      <BarChart3 size={20} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id); }}
                      className="w-12 h-12 bg-red-500/20 backdrop-blur-md text-red-100 border border-red-500/30 rounded-2xl flex items-center justify-center hover:bg-red-600 hover:text-white hover:scale-110 active:scale-95 transition-all shadow-xl"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <p className="text-xs font-bold text-slate-800 truncate">{asset.name}</p>
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
          );
        })}
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
              ) : previewAsset.type === 'WEB' ? (
                <iframe src={previewAsset.url} className="w-full h-full border-0 bg-white" title={previewAsset.name} />
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
                  Size: {(parseInt(previewAsset.size || '0') / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── Widget Modal ──── */}
      {showWidgetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-200"
          onClick={() => setShowWidgetModal(false)}
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" />
          <div
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-[36px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-400"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-8 py-6 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-black text-2xl tracking-tight">
                    {editingWidget ? '編輯動態看板' : '建立高質感動態看板'}
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">整合時鐘、天氣、跑馬燈於一身的 Dashboard</p>
                </div>
                <button onClick={() => setShowWidgetModal(false)} className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="p-8 overflow-y-auto w-full space-y-8 bg-slate-50/50">
              {/* Basic Section */}
              <section className="space-y-4">
                <h3 className="text-sm font-black text-slate-800 border-b pb-2">📂 基本設定</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">看板名稱</label>
                    <input
                      type="text"
                      value={widgetForm.name}
                      onChange={e => setWidgetForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all shadow-sm"
                      placeholder="例如：大廳首頁看板"
                    />
                  </div>
                </div>
              </section>

              {/* Modules Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Clock & Date */}
                <section className="space-y-4">
                  <h3 className="text-sm font-black text-slate-800 border-b pb-2 flex items-center gap-2"><Clock size={16}/> 數位時鐘</h3>
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                    {[
                      { key: 'showDate', label: '顯示日期標籤' },
                      { key: 'showSeconds', label: '顯示閃爍秒針' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center justify-between cursor-pointer">
                        <span className="font-bold text-slate-600 text-sm">{label}</span>
                        <button
                          type="button"
                          onClick={() => setWidgetForm(f => ({ ...f, [key]: !(f as any)[key] }))}
                          className={`w-11 h-6 rounded-full transition-all relative ${(widgetForm as any)[key] ? 'bg-violet-600' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${(widgetForm as any)[key] ? 'left-6' : 'left-1'}`} />
                        </button>
                      </label>
                    ))}
                  </div>
                </section>

                {/* Weather */}
                <section className="space-y-4">
                  <h3 className="text-sm font-black text-slate-800 border-b pb-2 flex items-center gap-2"><CloudSun size={16}/> 天氣資訊</h3>
                  <div className="space-y-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    {[
                      { key: 'city', label: '顯示城市名稱', placeholder: '例：台北市', type: 'text' },
                      { key: 'lat', label: '緯度 (Latitude)', placeholder: '25.04', type: 'number' },
                      { key: 'lon', label: '經度 (Longitude)', placeholder: '121.51', type: 'number' },
                    ].map(({ key, label, placeholder, type }) => (
                      <div key={key}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
                        <input
                          type={type}
                          value={(widgetForm as any)[key]}
                          onChange={e => setWidgetForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 text-sm outline-none focus:border-violet-400 transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </section>

              </div>

               {/* Announcement Marquee */}
               <section className="space-y-4">
                 <h3 className="text-sm font-black text-slate-800 border-b pb-2 flex items-center justify-between">
                   <div className="flex items-center gap-2"><Megaphone size={16}/> 底部跑馬燈公告</div>
                   <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                     <button 
                       onClick={() => setWidgetForm(f => ({ ...f, contentType: 'manual' }))}
                       className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${widgetForm.contentType === 'manual' ? 'bg-white shadow text-violet-600' : 'text-slate-500'}`}
                     >自訂文字</button>
                     <button 
                       onClick={() => setWidgetForm(f => ({ ...f, contentType: 'news' }))}
                       className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${widgetForm.contentType === 'news' ? 'bg-white shadow text-violet-600' : 'text-slate-500'}`}
                     >即時新聞</button>
                   </div>
                 </h3>
                 <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div className="space-y-3 col-span-1 md:col-span-2">
                    {[
                      { key: 'title', label: '標題 (選填)', placeholder: '焦點公告' },
                      { key: 'content', label: '內容', placeholder: '輸入要廣播的文字訊息...' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
                        {key === 'content' ? (
                          <textarea
                            rows={2}
                            value={(widgetForm as any)[key]}
                            onChange={e => setWidgetForm(f => ({ ...f, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-violet-400 transition-all resize-none text-sm shadow-sm ${widgetForm.contentType === 'news' ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                            disabled={widgetForm.contentType === 'news'}
                          />
                        ) : (
                          <input
                            type="text"
                            value={(widgetForm as any)[key]}
                            onChange={e => setWidgetForm(f => ({ ...f, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-violet-400 transition-all text-sm shadow-sm"
                          />
                        )}
                      </div>
                    ))}
                    {widgetForm.contentType === 'news' && (
                      <div className="space-y-4 mt-2 animate-in slide-in-from-top-2 duration-300">
                        <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl">
                          <div className="flex items-start gap-4 mb-4">
                            <Zap size={20} className="text-violet-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-black text-violet-900 leading-none">即時新聞模式已啟動</p>
                                <p className="text-[10px] text-violet-600 font-bold mt-1.5 leading-relaxed">
                                    請從下方選擇熱門新聞來源，或在輸入框貼上您專屬的 RSS 連結。系統將自動介接 Google RSS 提供最新頭條新聞標題。標題欄位（如有設定）將作為導讀前綴顯示。
                                </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">RSS 來源預設</label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { label: '🇹🇼 Google 新聞 (台灣)', url: 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
                                { label: '🌟 Yahoo 新聞', url: 'https://tw.news.yahoo.com/rss/' },
                                { label: '📰 聯合新聞網', url: 'https://udn.com/rssfeed/news/1' },
                                { label: '🗽 自由時報', url: 'https://news.ltn.com.tw/rss/all.xml' },
                                { label: '📺 TVBS 新聞', url: 'https://news.tvbs.com.tw/rss/news/' },
                                { label: '💻 TechCrunch', url: 'https://techcrunch.com/feed/' },
                                { label: '🚀 科技新報', url: 'https://technews.tw/feed/' },
                                { label: '🧪 泛科學', url: 'https://pansci.asia/feed' },
                                { label: '📊 MoneyDJ 財經', url: 'https://www.moneydj.com/KMDJ/RssFeed.aspx?topic=100' }
                              ].map(p => (
                                <button
                                  key={p.url}
                                  onClick={() => setWidgetForm(f => ({ ...f, newsUrl: p.url }))}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${widgetForm.newsUrl === p.url ? 'bg-violet-600 border-violet-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-violet-400'}`}
                                >{p.label}</button>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">RSS URL 連結</label>
                            <input
                              type="text"
                              value={widgetForm.newsUrl}
                              onChange={e => setWidgetForm(f => ({ ...f, newsUrl: e.target.value }))}
                              placeholder="貼上 RSS 連結 (例如: https://.../rss.xml)"
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs outline-none focus:border-violet-400 shadow-sm"
                            />
                          </div>
                      </div>
                    </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 justify-center">
                    {[
                      { key: 'bgColor', label: '底部背景色' },
                      { key: 'textColor', label: '文字顏色' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">{label}</label>
                        <input type="color" value={(widgetForm as any)[key]} onChange={e => setWidgetForm(f => ({ ...f, [key]: e.target.value }))} className="w-8 h-8 rounded shrink-0 border border-slate-200 cursor-pointer" />
                        <span className="text-xs font-mono font-bold text-slate-500 uppercase">{(widgetForm as any)[key]}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col justify-center border-l pl-5 space-y-6">
                    <label className="flex flex-col gap-3 cursor-pointer">
                      <span className="font-bold text-slate-700 text-sm">跑馬燈滾動效果</span>
                      <button
                        type="button"
                        onClick={() => setWidgetForm(f => ({ ...f, scrolling: !f.scrolling }))}
                        className={`w-12 h-6 rounded-full transition-all relative ${widgetForm.scrolling ? 'bg-violet-600' : 'bg-slate-200'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${widgetForm.scrolling ? 'left-7' : 'left-1'}`} />
                      </button>
                    </label>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-slate-700 text-sm">滾動速度</label>
                        <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded-lg text-slate-500">
                          {widgetForm.marqueeSpeed}s {widgetForm.marqueeSpeed <= 25 ? '(快)' : widgetForm.marqueeSpeed >= 120 ? '(極慢)' : widgetForm.marqueeSpeed >= 60 ? '(慢)' : ''}
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="15" 
                        max="180" 
                        step="1"
                        value={widgetForm.marqueeSpeed}
                        onChange={e => setWidgetForm(f => ({ ...f, marqueeSpeed: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600"
                      />
                      <div className="flex justify-between text-[8px] font-black text-slate-300 uppercase tracking-widest">
                        <span>快</span>
                        <span>慢</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

            </div>

              {/* Footer Actions */}
              <div className="p-6 bg-white border-t border-slate-100 shrink-0">
                <button
                  onClick={handleWidgetSubmit}
                  disabled={widgetSaving || !widgetForm.name.trim()}
                  className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-slate-900/20 text-lg flex justify-center items-center gap-2"
                >
                  {widgetSaving ? '儲存中…' : (
                    <>✨ {editingWidget ? '儲存變更' : '建立專屬動態看板'}</>
                  )}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── URL Modal ──── */}
      {showUrlModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowUrlModal(false)}
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" />
          <div
            className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-400"
            onClick={e => e.stopPropagation()}
          >
            <div className={`px-8 py-6 shrink-0 flex items-center justify-between text-white ${editingUrlAsset ? 'bg-amber-500' : 'bg-sky-600'}`}>
              <div>
                <h2 className="font-black text-xl">{editingUrlAsset ? '修改網頁素材' : '新增網頁素材'}</h2>
                <p className={`${editingUrlAsset ? 'text-amber-50' : 'text-sky-100'} text-xs mt-1`}>內嵌外部網址、Dashboard 或即時網頁內容</p>
              </div>
              <button onClick={() => setShowUrlModal(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">名稱</label>
                <input
                  type="text"
                  value={urlForm.name}
                  onChange={e => setUrlForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-sky-400 transition-all shadow-sm"
                  placeholder="例如：公司形象網站"
                />
              </div>
              <div>
                <input
                  type="url"
                  value={urlForm.url}
                  onChange={e => setUrlForm(f => ({ ...f, url: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-sky-400 transition-all shadow-sm"
                  placeholder="https://example.com"
                />
              </div>
                <button
                onClick={handleUrlSubmit}
                disabled={urlSaving || !urlForm.name.trim() || !urlForm.url.trim()}
                className={`w-full py-4 text-white font-black rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl mt-4 ${editingUrlAsset ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/20' : 'bg-sky-600 hover:bg-sky-700 shadow-sky-900/20'}`}
              >
                {urlSaving ? '儲存中...' : (editingUrlAsset ? '儲存變更' : '儲存網頁素材')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
