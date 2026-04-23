'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import api, { Asset } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Upload, Trash2, FileVideo, Plus, Image as ImageIcon, Search, X, Play, Eye, Tag, BarChart3, Zap, Clock, CloudSun, Megaphone, Edit3, CheckSquare, Calendar, LayoutGrid, List as ListIcon, Filter, Crop, Youtube, Layers } from 'lucide-react';
import ImageCropperModal from './components/ImageCropperModal';
import YouTubeAssetModal from './components/YouTubeAssetModal';
import CampaignAssetModal from './components/CampaignAssetModal';
import WidgetRenderer, { WidgetConfig } from '@/components/WidgetRenderer';

type WidgetType = 'DASHBOARD';

interface WidgetFormState {
  name: string;
  widgetType: WidgetType;
  bgImageUrl?: string | null;
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
  showBottomTicker: boolean;
}

interface MarqueeFormState {
  name: string;
  title: string;
  titleBgColor: string;
  titleTextColor: string;
  textColor: string;
  contentType: 'manual' | 'news' | 'weather';
  content: string;
  newsUrl: string;
  scrolling: boolean;
  marqueeSpeed: number;
  showClock: boolean;
  clockBgColor: string;
  clockTextColor: string;
  bgImageUrl: string | null;
  bgColor: string;
  // Weather
  city: string;
  lat: string;
  lon: string;
}

const RSS_PRESETS = [
  { name: 'Google 新聞 (台灣)', url: 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'BBC 中文網', url: 'https://www.bbc.com/zhongwen/trad/index.xml' },
  { name: 'Yahoo 新聞', url: 'https://tw.news.yahoo.com/rss/all' },
  { name: '自由時報', url: 'https://news.ltn.com.tw/rss/all.xml' },
  { name: '中時電子報', url: 'https://www.chinatimes.com/rss/all.xml' },
];

// Helper for client-side image compression
const compressImage = (file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<Blob | File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob && blob.size < file.size) {
            resolve(blob);
          } else {
            resolve(file); // If compression doesn't save space, use original
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export const getYoutubeId = (url: string) => {
  if (!url) return '';
  try {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
  } catch (e) {
    return url;
  }
};

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

  // Filters & View Mode
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Bulk Selection State
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  
  const toggleSelection = (id: string) => {
    setSelectedAssetIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedAssetIds.size === filtered.length) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(filtered.map(a => a.id)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedAssetIds);
    const inUse = assets.filter(a => ids.includes(a.id) && (a as any).usageCount > 0);
    if (inUse.length > 0) {
      alert(`無法刪除！選取範圍內有 ${inUse.length} 個素材正在排程中使用。請先取消勾選它們。`);
      return;
    }
    if (!confirm(`確定要刪除選取的 ${ids.length} 個素材嗎？`)) return;
    try {
      await Promise.all(ids.map(id => api.delete(`/assets/${id}`)));
      setSelectedAssetIds(new Set());
      fetchAssets();
    } catch (err: any) {
      alert('部分刪除失敗');
      fetchAssets();
    }
  };

  const handleBulkAddTags = async () => {
    const newTag = prompt('請輸入要批次貼上的標籤名稱：');
    if (!newTag || !newTag.trim()) return;
    const tag = newTag.trim();
    const ids = Array.from(selectedAssetIds);
    try {
      await Promise.all(ids.map(id => {
        const asset = assets.find(a => a.id === id) as any;
        const existingTags = asset.tags || [];
        if (!existingTags.includes(tag)) {
          return api.patch(`/assets/${id}`, { tags: [...existingTags, tag] });
        }
        return Promise.resolve();
      }));
      setSelectedAssetIds(new Set());
      fetchAssets();
    } catch (err) {
      alert('批次標籤失敗');
    }
  };

  const handleBulkValidity = async () => {
    const validFromStr = prompt('請輸入上架日期 (YYYY-MM-DD)，留空代表不限：\n若要清除現有設定也請留空', '');
    if (validFromStr === null) return;
    const validUntilStr = prompt('請輸入下架日期 (YYYY-MM-DD)，留空代表不限：\n若要清除現有設定也請留空', '');
    if (validUntilStr === null) return;

    const vf = validFromStr.trim() ? validFromStr.trim() : null;
    const vu = validUntilStr.trim() ? validUntilStr.trim() : null;
    const ids = Array.from(selectedAssetIds);
    try {
      await Promise.all(ids.map(id => api.patch(`/assets/${id}`, { validFrom: vf, validUntil: vu })));
      setSelectedAssetIds(new Set());
      fetchAssets();
    } catch (err) {
      alert('批次效期失敗');
    }
  };

  // Widget Modal State
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState<any | null>(null);
  const [widgetSaving, setWidgetSaving] = useState(false); // Kept this state
  const [widgetForm, setWidgetForm] = useState<WidgetFormState>({
    name: '',
    widgetType: 'DASHBOARD', // Added widgetType
    bgImageUrl: null,
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
    marqueeSpeed: 10,
    showBottomTicker: true,
  });

  // Image Cropper State
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [editingImage, setEditingImage] = useState<any | null>(null);

  const openImageCropper = (asset: any) => {
    setEditingImage(asset);
    setShowImageCropper(true);
  };

  const handleSaveCrop = async (croppedBlob: Blob, newName: string) => {
    try {
      const file = new File([croppedBlob], newName, { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'IMAGE');
      if (editingImage?.tags) {
        formData.append('tags', JSON.stringify(editingImage.tags));
      }
      formData.append('duration', `${editingImage?.duration || 10}`);

      await api.post('/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchAssets();
    } catch (err) {
      console.error('Failed to upload cropped image:', err);
      alert('上傳裁切圖片失敗');
    }
  };

  // URL Modal State
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [editingUrlAsset, setEditingUrlAsset] = useState<any | null>(null);
  const [urlSaving, setUrlSaving] = useState(false);
  const [urlForm, setUrlForm] = useState({ name: '', url: '' });

  // YouTube Modal State
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [editingYouTubeAsset, setEditingYouTubeAsset] = useState<any | null>(null);

  // Campaign Modal State
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Asset | null>(null);

  const [showMarqueeModal, setShowMarqueeModal] = useState(false);
  const [editingMarquee, setEditingMarquee] = useState<any | null>(null);
  const [marqueeSaving, setMarqueeSaving] = useState(false);
  const defaultMarqueeForm: MarqueeFormState = {
    name: '跑馬燈素材',
    title: '自家屋電子看板',
    titleBgColor: '#0b486b',
    titleTextColor: '#FFFFFF',
    textColor: '#000000',
    contentType: 'manual',
    content: '歡迎光臨，祝您有美好的一天！✨',
    newsUrl: RSS_PRESETS[0].url,
    scrolling: true,
    marqueeSpeed: 10,
    showClock: true,
    clockBgColor: '#ec6715',
    clockTextColor: '#FFFFFF',
    bgImageUrl: null,
    bgColor: '#dee2ca',
    city: '台北市',
    lat: '25.04',
    lon: '121.51',
  };
  const [marqueeForm, setMarqueeForm] = useState<MarqueeFormState>(defaultMarqueeForm);

  const openEditYouTubeModal = (asset: any) => {
    setEditingYouTubeAsset(asset);
    setShowYoutubeModal(true);
  };

  const handleSaveYouTube = async (name: string, url: string, fixedDuration: boolean) => {
    if (editingYouTubeAsset) {
      await api.patch(`/assets/${editingYouTubeAsset.id}`, { name, url, fixedDuration });
      setEditingYouTubeAsset(null);
      fetchAssets();
    } else {
      await api.post('/assets/youtube', { name, url, fixedDuration });
      fetchAssets();
    }
  };

  const openEditCampaignModal = (asset: any) => {
    setEditingCampaign(asset);
    setShowCampaignModal(true);
  };

  const handleSaveCampaign = async (name: string, config: any) => {
    if (editingCampaign) {
      await api.patch(`/assets/${editingCampaign.id}`, { name, config });
    } else {
      await api.post('/assets/campaign', { name, config });
    }
    fetchAssets();
  };

  const openWidgetModal = () => {
    setEditingWidget(null);
    setWidgetForm({
      name: '我的動態看板', // Default name for new widget
      widgetType: 'DASHBOARD',
      bgImageUrl: null,
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
      marqueeSpeed: 10,
      showBottomTicker: true,
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
      bgImageUrl: config.bgImageUrl ?? null,
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
      marqueeSpeed: config.marqueeSpeed ?? 10,
      showBottomTicker: config.showBottomTicker ?? true,
    });
    setShowWidgetModal(true);
  };

  const handleWidgetSubmit = async () => {
    if (!widgetForm.name.trim()) return alert('請輸入名稱');
    setWidgetSaving(true); // Use the existing widgetSaving state

    const payload = {
      name: widgetForm.name,
      widgetType: widgetForm.widgetType,
      duration: 120, // Default fallback, scheduling will override
      config: {
        bgImageUrl: widgetForm.bgImageUrl,
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
        showBottomTicker: widgetForm.showBottomTicker,
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
  const triggerUpload = () => {
    console.log('Triggering upload...');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      const input = document.getElementById('asset-upload-input');
      if (input) {
        (input as HTMLInputElement).click();
      } else {
        console.error('Upload input not found');
        alert('系統錯誤：找不到上傳元件');
      }
    }
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

  // Marquee Modal Handlers
  const openMarqueeModal = () => {
    setEditingMarquee(null);
    setMarqueeForm({ ...defaultMarqueeForm, bgImageUrl: '/marquee/default-bg.png' });
    setShowMarqueeModal(true);
  };

  const openEditMarqueeModal = (asset: any) => {
    let config: any = {};
    try { config = JSON.parse(asset.url); } catch (e) {}
    setEditingMarquee(asset);
    setMarqueeForm({
      name: asset.name,
      title: config.title ?? '',
      titleBgColor: config.titleBgColor ?? '#0b486b',
      titleTextColor: config.titleTextColor ?? '#FFFFFF',
      textColor: config.textColor ?? '#000000',
      contentType: config.contentType ?? 'manual',
      content: config.content ?? '',
      newsUrl: config.newsUrl ?? RSS_PRESETS[0].url,
      scrolling: config.scrolling ?? true,
      marqueeSpeed: config.marqueeSpeed ?? 10,
      showClock: config.showClock ?? true,
      clockBgColor: config.clockBgColor ?? '#ec6715',
      clockTextColor: config.clockTextColor ?? '#FFFFFF',
      bgImageUrl: config.bgImageUrl ?? null,
      bgColor: config.bgColor ?? '#dee2ca',
      city: config.city ?? '台北市',
      lat: (config.lat ?? '25.04').toString(),
      lon: (config.lon ?? '121.51').toString(),
    });
    setShowMarqueeModal(true);
  };

  const handleMarqueeSubmit = async () => {
    if (!marqueeForm.name.trim()) return alert('請輸入名稱');
    setMarqueeSaving(true);
    const config = {
      title: marqueeForm.title,
      titleBgColor: marqueeForm.titleBgColor,
      titleTextColor: marqueeForm.titleTextColor,
      textColor: marqueeForm.textColor,
      contentType: marqueeForm.contentType,
      content: marqueeForm.content,
      newsUrl: marqueeForm.newsUrl,
      scrolling: marqueeForm.scrolling,
      marqueeSpeed: marqueeForm.marqueeSpeed,
      showClock: marqueeForm.showClock,
      clockBgColor: marqueeForm.clockBgColor,
      clockTextColor: marqueeForm.clockTextColor,
      bgImageUrl: marqueeForm.bgImageUrl,
      bgColor: marqueeForm.bgColor,
      city: marqueeForm.city,
      lat: marqueeForm.lat,
      lon: marqueeForm.lon,
    };
    try {
      if (editingMarquee) {
        await api.patch(`/assets/${editingMarquee.id}`, { name: marqueeForm.name, config });
      } else {
        await api.post('/assets/marquee', { name: marqueeForm.name, config });
      }
      setShowMarqueeModal(false);
      fetchAssets();
    } catch (err) {
      console.error(err);
      alert('儲存失敗');
    } finally {
      setMarqueeSaving(false);
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
    const asset = assets.find(a => a.id === id) as any;
    if (asset?.usageCount > 0) {
      alert(`無法刪除！此素材目前正在以下排程中使用：\n\n${(asset.schedules || []).join('\n')}\n\n請先將其從排程中移除。`);
      return;
    }

    if (!confirm('確定要刪除此素材嗎？')) return;
    try {
      await api.delete(`/assets/${id}`);
      const res = await api.get('/assets');
      setAssets(res.data);
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert(err.response.data.error || '無法刪除，因素材正在使用中。');
      } else {
        console.error(err);
        alert('刪除失敗');
      }
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

  const filtered = useMemo(() => {
    return assets.filter(a => {
      const q = searchQuery.toLowerCase();
      const matchSearch = String(a.name).toLowerCase().includes(q) || 
                          ((a as any).tags || []).some((t: string) => t.toLowerCase().includes(q));
      
      const matchType = filterType === 'ALL' || a.type === filterType;
      
      let matchStatus = true;
      if (filterStatus === 'IN_USE') matchStatus = ((a as any).usageCount || 0) > 0;
      else if (filterStatus === 'UNUSED') matchStatus = (!((a as any).usageCount || 0) || (a as any).usageCount === 0);

      return matchSearch && matchType && matchStatus;
    });
  }, [searchQuery, assets, filterType, filterStatus]);
  
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
            {/* Marquee Button */}
            <button
              onClick={openMarqueeModal}
              className="group relative inline-flex items-center gap-2 px-6 py-4 bg-amber-600 text-white rounded-2xl font-bold shadow-xl shadow-amber-900/20 hover:bg-amber-700 transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <Megaphone size={18} />
              建立跑馬燈
            </button>
            {/* Campaign Button */}
            <button
              onClick={() => { setEditingCampaign(null); setShowCampaignModal(true); }}
              className="group relative inline-flex items-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-900/20 hover:bg-indigo-700 transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <Layers size={18} />
              建立活動托播
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
            {/* YouTube Button */}
            <button
              onClick={() => setShowYoutubeModal(true)}
              className="group relative inline-flex items-center gap-2 px-6 py-4 bg-red-600 text-white rounded-2xl font-bold shadow-xl shadow-red-900/20 hover:bg-red-700 transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <Youtube size={18} />
              YouTube
            </button>
            {/* Upload Button */}
            <button
              onClick={triggerUpload}
              disabled={uploading}
              className="group relative inline-flex items-center px-6 py-4 bg-[#1A5336] text-white rounded-2xl font-bold shadow-xl shadow-green-900/10 hover:bg-[#1A5336]/90 transition-all overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 pointer-events-none" />
              <Upload size={18} className="mr-2 pointer-events-none" />
              <span className="pointer-events-none">
                {uploading ? `上傳中 ${uploadProgress}%` : '上傳新素材'}
              </span>
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

      </div>

      <input
        type="file"
        id="asset-upload-input"
        ref={fileInputRef}
        onChange={handleUpload}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: '0',
          opacity: '0',
          pointerEvents: 'none',
          zIndex: -1
        }}
        accept="image/*,video/*"
        multiple
      />

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

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-4 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-violet-500 cursor-pointer">
              <option value="ALL">全部類型</option>
              <option value="IMAGE">圖片 (Image)</option>
              <option value="VIDEO">影片 (Video)</option>
              <option value="WIDGET">微件 (Widget)</option>
              <option value="WEB">網頁 (Web)</option>
              <option value="YOUTUBE">YouTube</option>
              <option value="CAMPAIGN">活動托播 (Campaign)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-white border-2 border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-violet-500 cursor-pointer">
              <option value="ALL">所有狀態</option>
              <option value="IN_USE">🔗 運用中</option>
              <option value="UNUSED">👻 閒置/未排程</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-200/50 p-1 rounded-xl shrink-0">
          <button onClick={() => setViewMode('GRID')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-white shadow text-violet-600' : 'text-slate-500 hover:text-slate-700'}`}>
            <LayoutGrid size={18} />
          </button>
          <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white shadow text-violet-600' : 'text-slate-500 hover:text-slate-700'}`}>
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      {/* Bulk Action FAB (Floating Action Bar) */}
      {selectedAssetIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-700/50 shadow-2xl shadow-slate-900/50 rounded-full px-6 py-4 flex items-center gap-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
            <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-inner">
              {selectedAssetIds.size}
            </div>
            <span className="font-bold text-sm text-slate-300">已選取</span>
            <button
               onClick={() => setSelectedAssetIds(new Set())}
               className="ml-2 text-xs font-bold text-slate-500 hover:text-white transition-all underline outline-none"
             >取消全選</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkAddTags} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
              <Tag size={16}/> 批次加標籤
            </button>
            <button onClick={handleBulkValidity} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
              <Calendar size={16}/> 批次上下架
            </button>
            <button onClick={handleBulkDelete} className="ml-2 px-4 py-2 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2">
              <Trash2 size={16}/> 批次安全刪除
            </button>
          </div>
        </div>
      )}

      {viewMode === 'LIST' ? (
        <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-bold tracking-wider uppercase">
                  <th className="p-4 w-12 text-center">
                    <input type="checkbox" onChange={handleSelectAll} checked={selectedAssetIds.size > 0 && selectedAssetIds.size === filtered.length} className="w-4 h-4 rounded border-slate-300 text-violet-600 cursor-pointer"/>
                  </th>
                  <th className="p-4 w-16">預覽</th>
                  <th className="p-4">素材名稱</th>
                  <th className="p-4">類型</th>
                  <th className="p-4">狀態</th>
                  <th className="p-4">標籤 / 效期</th>
                  <th className="p-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(asset => (
                  <tr key={asset.id} onClick={() => toggleSelection(asset.id)} className={`group hover:bg-slate-50 transition-all cursor-pointer ${selectedAssetIds.has(asset.id) ? 'bg-violet-50/50' : ''}`}>
                    <td className="p-4 text-center">
                      <input type="checkbox" checked={selectedAssetIds.has(asset.id)} onChange={(e) => { e.stopPropagation(); toggleSelection(asset.id); }} onClick={e => e.stopPropagation()} className="w-4 h-4 rounded border-slate-300 text-violet-600 cursor-pointer"/>
                    </td>
                    <td className="p-4">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-900 border border-slate-200/50 shadow-inner flex flex-col items-center justify-center shrink-0">
                        {asset.thumbnailUrl ? (
                          <img src={asset.thumbnailUrl} className="w-full h-full object-cover" />
                        ) : asset.type === 'WIDGET' ? (
                          <span className="text-xl">🪄</span>
                        ) : asset.type === 'WEB' ? (
                          <span className="text-xl">🌐</span>
                        ) : asset.type === 'YOUTUBE' ? (
                          <img src={asset.thumbnailUrl || ''} className="w-full h-full object-cover" />
                        ) : asset.type === 'CAMPAIGN' ? (
                           <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white">
                             <Layers size={18} />
                           </div>
                        ) : asset.type === 'IMAGE' ? (
                           <img src={asset.url} className="w-full h-full object-cover" />
                        ) : (
                           <FileVideo className="text-slate-500" size={20} />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800 break-all line-clamp-2 max-w-[200px]">{asset.name}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-black tracking-wider uppercase rounded">{asset.type}</span>
                    </td>
                    <td className="p-4">
                      {((asset as any).usageCount || 0) > 0 ? (
                        <span className="px-2.5 py-1 bg-green-100/80 text-green-700 text-xs rounded-lg font-bold">🔗 運用中 ({((asset as any).usageCount)})</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-xs rounded-lg font-bold">👻 閒置</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {((asset as any).tags || []).map((t: string) => <span key={`tag-${t}`} className="px-1.5 py-0.5 bg-slate-200 rounded text-[10px] font-bold text-slate-600">{t}</span>)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold flex flex-col">
                        {(asset as any).validFrom && <span>開始: {new Date((asset as any).validFrom).toLocaleDateString()}</span>}
                        {(asset as any).validUntil && <span>結束: {new Date((asset as any).validUntil).toLocaleDateString()}</span>}
                      </div>
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                       {/* Preview Button for all types */}
                       <button 
                         onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); }} 
                         className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all" 
                         title="預覽"
                       >
                         <Eye size={16}/>
                       </button>

                       {asset.type === 'IMAGE' ? (
                          <button onClick={(e) => { e.stopPropagation(); openImageCropper(asset); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="裁切編輯">
                            <Crop size={16}/>
                          </button>
                       ) : null}
                       {asset.type === 'WIDGET' ? (
                          <button onClick={(e) => { e.stopPropagation(); openEditWidgetModal(asset); }} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all" title="編輯微件">
                            <Edit3 size={16}/>
                          </button>
                       ) : null}
                       {asset.type === 'WEB' ? (
                          <button onClick={(e) => { e.stopPropagation(); openEditUrlModal(asset); }} className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-all" title="編輯網頁">
                            <Edit3 size={16}/>
                          </button>
                       ) : null}
                       {asset.type === 'YOUTUBE' ? (
                          <button onClick={(e) => { e.stopPropagation(); openEditYouTubeModal(asset); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="編輯 YouTube">
                            <Youtube size={16}/>
                          </button>
                       ) : null}
                       {asset.type === 'MARQUEE' ? (
                          <button onClick={(e) => { e.stopPropagation(); openEditMarqueeModal(asset); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="編輯跑馬燈">
                            <Megaphone size={16}/>
                          </button>
                       ) : null}
                       {asset.type === 'CAMPAIGN' ? (
                          <button onClick={(e) => { e.stopPropagation(); openEditCampaignModal(asset); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="編輯活動托播">
                            <Megaphone size={16}/>
                          </button>
                       ) : null}
                      <button onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="刪除">
                        <Trash2 size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400 font-bold">沒有符合過濾條件的素材</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-6 space-y-6">
        {/* Special Add Box */}
        <div className="break-inside-avoid">
          <button
            onClick={triggerUpload}
            className="w-full aspect-[3/4] border-2 border-dashed border-slate-200 rounded-[28px] flex flex-col items-center justify-center text-slate-400 hover:border-[#1A5336] hover:text-[#1A5336] hover:bg-green-50/30 transition-all group cursor-pointer"
          >
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-[#1A5336]/10 group-hover:scale-110 transition-all pointer-events-none">
              <Plus size={32} />
            </div>
            <span className="text-sm font-bold pointer-events-none">新增媒體</span>
          </button>
        </div>

        {filtered.map((asset) => {
          // ─── Widget Card ───────────────────────────────────────
          if (asset.type === 'WIDGET') {
            return (
              <div key={asset.id} onClick={() => { if (selectedAssetIds.size > 0) toggleSelection(asset.id); }} className={`break-inside-avoid group border rounded-[28px] overflow-hidden hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 relative flex flex-col ${selectedAssetIds.size > 0 ? 'cursor-pointer' : ''} ${selectedAssetIds.has(asset.id) ? 'border-violet-500 bg-violet-900/40 ring-4 ring-violet-500/20' : 'bg-slate-900 border-slate-700 hover:shadow-violet-500/30'}`}>
                
                {/* Checkbox Overlay */}
                <div className={`absolute top-4 left-4 z-40 transition-all ${selectedAssetIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <div onClick={(e) => { e.stopPropagation(); toggleSelection(asset.id); }} className={`w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2 ${selectedAssetIds.has(asset.id) ? 'bg-violet-600 border-violet-600' : 'bg-black/40 backdrop-blur-md border-white/50 hover:border-white'}`}>
                    {selectedAssetIds.has(asset.id) && <CheckSquare size={16} className="text-white" />}
                  </div>
                </div>

                <div className="relative overflow-hidden aspect-video bg-black flex flex-col items-center justify-center gap-2 p-4 cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600/40 via-blue-900/40 to-emerald-600/40 opacity-80 blur-xl pointer-events-none" />
                  <span style={{ fontSize: 40 }} className="relative z-10 drop-shadow-2xl">🪄</span>
                  <span className="text-white font-black text-sm relative z-10 tracking-widest">DASHBOARD</span>
                  <div className="absolute inset-0 bg-violet-900/80 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-4">
                    <div className="flex gap-2">
                       <button
                        onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); }}
                        className="bg-violet-500/20 backdrop-blur-md text-violet-100 px-4 py-2 rounded-xl border border-violet-500/20 hover:bg-violet-500/40 transition-all font-bold text-xs flex items-center gap-2"
                      >
                        <Eye size={14} /> 預覽
                      </button>
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
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-white truncate pr-2">{asset.name}</p>
                    {((asset as any).usageCount || 0) > 0 ? (
                      <span className="text-[9px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded font-bold shrink-0 cursor-help" title={`使用中的排程：\n${((asset as any).schedules || []).join('\n')}`}>🔗 {((asset as any).usageCount || 0)}</span>
                    ) : (
                      <span className="text-[9px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded font-bold shrink-0">👻 閒置</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">{asset.duration ?? 10}秒 顯示</p>
                </div>
              </div>
            );
          }

          // ─── Marquee Card ───────────────────────────────────────
          if (asset.type === 'MARQUEE') {
            return (
              <div key={asset.id} onClick={() => { if (selectedAssetIds.size > 0) toggleSelection(asset.id); }} className={`break-inside-avoid group border rounded-[28px] overflow-hidden hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 relative flex flex-col ${selectedAssetIds.size > 0 ? 'cursor-pointer' : ''} ${selectedAssetIds.has(asset.id) ? 'border-amber-500 bg-amber-900/40 ring-4 ring-amber-500/20' : 'bg-gradient-to-br from-amber-900 to-orange-900 border-amber-700 hover:shadow-amber-500/30'}`}>
                
                {/* Checkbox Overlay */}
                <div className={`absolute top-4 left-4 z-40 transition-all ${selectedAssetIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <div onClick={(e) => { e.stopPropagation(); toggleSelection(asset.id); }} className={`w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2 ${selectedAssetIds.has(asset.id) ? 'bg-amber-600 border-amber-600' : 'bg-black/40 backdrop-blur-md border-white/50 hover:border-white'}`}>
                    {selectedAssetIds.has(asset.id) && <CheckSquare size={16} className="text-white" />}
                  </div>
                </div>

                <div className="relative overflow-hidden aspect-video bg-black flex flex-col items-center justify-center gap-2 p-4 cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600/40 via-orange-500/30 to-teal-600/40 opacity-80 blur-xl pointer-events-none" />
                  <span style={{ fontSize: 40 }} className="relative z-10 drop-shadow-2xl">📢</span>
                  <span className="text-white font-black text-sm relative z-10 tracking-widest">MARQUEE</span>
                  <div className="absolute inset-0 bg-amber-900/80 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-4">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditMarqueeModal(asset); }}
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
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-white truncate pr-2">{asset.name}</p>
                    {((asset as any).usageCount || 0) > 0 ? (
                      <span className="text-[9px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded font-bold shrink-0">🔗 {((asset as any).usageCount || 0)}</span>
                    ) : (
                      <span className="text-[9px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded font-bold shrink-0">👻 閒置</span>
                    )}
                  </div>
                  <p className="text-[10px] text-amber-300/70 font-bold mt-0.5">跑馬燈素材</p>
                </div>
              </div>
            );
          }

          // ─── Web/URL Card ───────────────────────────────────────
          if (asset.type === 'WEB') {
            return (
              <div key={asset.id} onClick={() => { if (selectedAssetIds.size > 0) toggleSelection(asset.id); }} className={`break-inside-avoid group border rounded-[28px] overflow-hidden hover:-translate-y-1.5 transition-all duration-300 relative flex flex-col ${selectedAssetIds.size > 0 ? 'cursor-pointer' : ''} ${selectedAssetIds.has(asset.id) ? 'border-sky-500 bg-sky-50 shadow-2xl shadow-sky-500/20 ring-4 ring-sky-500/20' : 'bg-slate-100 border-slate-200 hover:shadow-2xl hover:shadow-sky-500/30'}`}>
                
                {/* Checkbox Overlay */}
                <div className={`absolute top-4 left-4 z-40 transition-all ${selectedAssetIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <div onClick={(e) => { e.stopPropagation(); toggleSelection(asset.id); }} className={`w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2 ${selectedAssetIds.has(asset.id) ? 'bg-sky-500 border-sky-500' : 'bg-black/20 backdrop-blur-md border-black/30 hover:border-black/50'}`}>
                    {selectedAssetIds.has(asset.id) && <CheckSquare size={16} className="text-white" />}
                  </div>
                </div>

                <div className="relative overflow-hidden aspect-video bg-white flex flex-col items-center justify-center gap-2 p-4 cursor-pointer">
                  {asset.thumbnailUrl ? (
                    <img src={asset.thumbnailUrl} alt={asset.name} className="w-16 h-16 object-contain" />
                  ) : (
                    <span style={{ fontSize: 40 }} className="relative z-10 drop-shadow-2xl">🌐</span>
                  )}
                  <span className="text-slate-900 font-black text-[10px] relative z-10 tracking-widest uppercase truncate max-w-full px-2">{new URL(asset.url).hostname}</span>
                  <div className="absolute inset-0 bg-sky-900/80 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-4">
                    <div className="flex gap-2">
                       <button
                        onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); }}
                        className="bg-sky-500/20 backdrop-blur-md text-sky-100 px-4 py-2 rounded-xl border border-sky-500/20 hover:bg-sky-500/40 transition-all font-bold text-xs flex items-center gap-2"
                      >
                        <Eye size={14} /> 預覽
                      </button>
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
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-slate-800 truncate pr-2">{asset.name}</p>
                    {((asset as any).usageCount || 0) > 0 ? (
                      <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold shrink-0 cursor-help" title={`使用中的排程：\n${((asset as any).schedules || []).join('\n')}`}>🔗 {((asset as any).usageCount || 0)}</span>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold shrink-0">👻 閒置</span>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // ─── YouTube Card ───────────────────────────────────────
          if (asset.type === 'YOUTUBE') {
            return (
              <div key={asset.id} onClick={() => { if (selectedAssetIds.size > 0) toggleSelection(asset.id); }} className={`break-inside-avoid group border rounded-[28px] overflow-hidden hover:-translate-y-1.5 transition-all duration-300 relative flex flex-col ${selectedAssetIds.size > 0 ? 'cursor-pointer' : ''} ${selectedAssetIds.has(asset.id) ? 'border-red-500 bg-red-50 shadow-2xl shadow-red-500/20 ring-4 ring-red-500/20' : 'bg-slate-100 border-slate-200 hover:shadow-2xl hover:shadow-red-500/30'}`}>
                
                {/* Checkbox Overlay */}
                <div className={`absolute top-4 left-4 z-40 transition-all ${selectedAssetIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <div onClick={(e) => { e.stopPropagation(); toggleSelection(asset.id); }} className={`w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2 ${selectedAssetIds.has(asset.id) ? 'bg-red-600 border-red-600' : 'bg-black/20 backdrop-blur-md border-white/50 hover:border-white'}`}>
                    {selectedAssetIds.has(asset.id) && <CheckSquare size={16} className="text-white" />}
                  </div>
                </div>

                <div className="relative overflow-hidden aspect-video bg-black flex items-center justify-center cursor-pointer">
                  {asset.thumbnailUrl ? (
                    <img src={asset.thumbnailUrl} alt={asset.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <Youtube size={48} className="text-red-600" />
                  )}
                  <div className="absolute inset-0 bg-red-600/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); }}
                      className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 hover:bg-white/30 transition-all font-bold text-xs flex items-center gap-2"
                    >
                      <Eye size={14} /> 預覽
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditYouTubeModal(asset); }}
                      className="bg-red-500/20 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 hover:bg-white/30 transition-all font-bold text-xs flex items-center gap-2"
                    >
                      <Edit3 size={14} /> 編輯
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id); }}
                      className="bg-red-500/20 backdrop-blur-md text-red-200 px-4 py-2 rounded-xl border border-red-500/20 hover:bg-red-500/40 transition-all font-bold text-xs flex items-center gap-2"
                    >
                      <Trash2 size={14} /> 刪除
                    </button>
                  </div>
                  <div className="absolute top-3 right-3 z-20">
                    <span className="px-2 py-0.5 bg-red-600 text-white text-[8px] font-black uppercase rounded shadow-lg">YouTube</span>
                  </div>
                </div>
                <div className="p-3 bg-white border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-800 truncate mb-1">{asset.name}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-slate-400 font-bold">ID: {asset.url}</span>
                    {((asset as any).usageCount || 0) > 0 ? (
                      <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold shrink-0">🔗 {((asset as any).usageCount || 0)}</span>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold shrink-0">👻 閒置</span>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // ─── Campaign Card ──────────────────────────────────────
          if (asset.type === 'CAMPAIGN') {
            return (
              <div key={asset.id} onClick={() => { if (selectedAssetIds.size > 0) toggleSelection(asset.id); }} className={`break-inside-avoid group border rounded-[28px] overflow-hidden hover:-translate-y-1.5 transition-all duration-300 relative flex flex-col ${selectedAssetIds.size > 0 ? 'cursor-pointer' : ''} ${selectedAssetIds.has(asset.id) ? 'border-indigo-600 bg-indigo-50 shadow-2xl shadow-indigo-500/20 ring-4 ring-indigo-500/20' : 'bg-slate-100 border-slate-200 hover:shadow-2xl hover:shadow-indigo-500/30'}`}>
                
                {/* Checkbox Overlay */}
                <div className={`absolute top-4 left-4 z-40 transition-all ${selectedAssetIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <div onClick={(e) => { e.stopPropagation(); toggleSelection(asset.id); }} className={`w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2 ${selectedAssetIds.has(asset.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-black/20 backdrop-blur-md border-white/50 hover:border-white'}`}>
                    {selectedAssetIds.has(asset.id) && <CheckSquare size={16} className="text-white" />}
                  </div>
                </div>

                <div className="relative overflow-hidden aspect-video bg-slate-900 flex items-center justify-center cursor-pointer">
                  {asset.thumbnailUrl ? (
                    <img src={asset.thumbnailUrl} alt={asset.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <Layers size={48} className="text-indigo-400" />
                  )}
                  <div className="absolute inset-0 bg-indigo-900/80 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-4">
                    <button onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); }} className="bg-indigo-500/20 backdrop-blur-md text-indigo-100 px-4 py-2 rounded-xl border border-indigo-500/20 hover:bg-indigo-500/40 transition-all font-bold text-xs flex items-center gap-2">
                      <Eye size={14} /> 預覽
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openEditCampaignModal(asset); }} className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 hover:bg-white/30 transition-all font-bold text-xs flex items-center gap-2">
                      <Edit3 size={14} /> 編輯
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id); }} className="bg-red-500/20 backdrop-blur-md text-red-200 px-4 py-2 rounded-xl border border-red-500/20 hover:bg-red-500/40 transition-all font-bold text-xs flex items-center gap-2">
                      <Trash2 size={14} /> 刪除
                    </button>
                  </div>
                  <div className="absolute top-3 right-3 z-20">
                    <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded shadow-lg">活動托播</span>
                  </div>
                </div>
                <div className="p-3 bg-white border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-800 truncate mb-1">{asset.name}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-indigo-500 font-bold">複合素材</span>
                    {((asset as any).usageCount || 0) > 0 ? (
                      <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold shrink-0">🔗 {((asset as any).usageCount || 0)}</span>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold shrink-0">👻 閒置</span>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // ─── Media Card (IMAGE / VIDEO) ────────────────────────
          return (
            <div key={asset.id} onClick={() => { if (selectedAssetIds.size > 0) toggleSelection(asset.id); }} className={`break-inside-avoid group border rounded-[28px] overflow-hidden hover:-translate-y-1.5 transition-all duration-300 relative flex flex-col ${selectedAssetIds.size > 0 ? 'cursor-pointer' : ''} ${selectedAssetIds.has(asset.id) ? 'border-[#1A5336] bg-green-50 shadow-2xl shadow-green-500/20 ring-4 ring-[#1A5336]/20' : 'bg-white border-slate-200/60 hover:shadow-2xl hover:shadow-slate-200/50'}`}>
              
              {/* Checkbox Overlay */}
              <div className={`absolute top-4 left-4 z-40 transition-all ${selectedAssetIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <div onClick={(e) => { e.stopPropagation(); toggleSelection(asset.id); }} className={`w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2 ${selectedAssetIds.has(asset.id) ? 'bg-[#1A5336] border-[#1A5336]' : 'bg-black/20 backdrop-blur-md border-white/50 hover:border-white'}`}>
                  {selectedAssetIds.has(asset.id) && <CheckSquare size={16} className="text-white" />}
                </div>
              </div>

              <div className={`relative overflow-hidden bg-slate-100 cursor-pointer ${asset.orientation === 'PORTRAIT' ? 'aspect-[9/16]' : 'aspect-video'}`}>
                {(asset.type === 'IMAGE' || asset.thumbnailUrl) ? (
                  <div className="relative w-full h-full">
                    <img src={asset.thumbnailUrl || (asset.type === 'IMAGE' ? asset.url : '')} alt={asset.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
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

                <div className="absolute top-4 left-14 z-20">
                  <span className="px-3 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-tighter rounded-full border border-white/20">
                    {asset.type === 'IMAGE' ? 'Image' : 'Video'}
                  </span>
                </div>

                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-[#1A5336]/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/10">
                    {asset.orientation === 'PORTRAIT' ? '9:16' : '16:9'}
                  </span>
                </div>

                <div className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); }}
                      className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/20 hover:bg-white/30 transition-all font-bold text-xs flex items-center gap-2"
                    >
                      <Eye size={14} /> 預覽
                    </button>
                    {asset.type === 'IMAGE' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openImageCropper(asset); }}
                        className="bg-emerald-500/20 backdrop-blur-md text-emerald-100 px-4 py-2 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/40 transition-all font-bold text-xs flex items-center gap-2"
                      >
                        <Crop size={14} /> 裁切
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id); }}
                      className="bg-red-500/20 backdrop-blur-md text-red-200 px-4 py-2 rounded-xl border border-red-500/20 hover:bg-red-500/40 transition-all font-bold text-xs flex items-center gap-2"
                    >
                      <Trash2 size={14} /> 刪除
                    </button>
                  </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-bold text-slate-800 truncate pr-2">{asset.name}</p>
                  {((asset as any).usageCount || 0) > 0 ? (
                    <span className="text-[9px] bg-green-100 text-[#1A5336] px-1.5 py-0.5 rounded font-bold shrink-0 cursor-help" title={`使用中的排程：\n${((asset as any).schedules || []).join('\n')}`}>🔗 運用中 ({((asset as any).usageCount || 0)})</span>
                  ) : (
                    <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold shrink-0">👻 未排程</span>
                  )}
                </div>
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
      )}

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
              ) : previewAsset.type === 'YOUTUBE' ? (
                <iframe 
                  src={`https://www.youtube.com/embed/${previewAsset.url}?autoplay=1&mute=0&rel=0`} 
                  className="w-full h-full border-0" 
                  allow="autoplay; encrypted-media; fullscreen" 
                  title={previewAsset.name} 
                />
              ) : previewAsset.type === 'WEB' ? (
                <iframe src={previewAsset.url} className="w-full h-full border-0 bg-white" title={previewAsset.name} />
              ) : previewAsset.type === 'WIDGET' ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <div className="w-full h-full shadow-2xl rounded-2xl overflow-hidden">
                    {(() => {
                      try {
                        return <WidgetRenderer widgetConfig={JSON.parse(previewAsset.url) as WidgetConfig} />;
                      } catch (e) {
                        return <div className="text-white">Widget 配置錯誤</div>;
                      }
                    })()}
                  </div>
                </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1 justify-between">
                      <span>自訂背景圖片</span>
                      {widgetForm.bgImageUrl && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">已套用</span>}
                    </label>
                    <div className="flex gap-2 min-w-0">
                      {widgetForm.bgImageUrl ? (
                        <div className="relative w-full h-[50px] rounded-xl overflow-hidden border border-slate-200 group">
                           <img src={widgetForm.bgImageUrl} className="w-full h-full object-cover" />
                           <button type="button" onClick={() => setWidgetForm(f => ({...f, bgImageUrl: null}))} className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center font-bold opacity-0 group-hover:opacity-100 transition-all text-sm rounded-xl">清除並恢復預設</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e: any) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              try {
                                // Compress image before upload
                                const processedFile = await compressImage(f);
                                const formData = new FormData();
                                formData.append('file', processedFile, f.name);
                                const res = await api.post('/assets/upload-raw', formData, {
                                  headers: { 'Content-Type': 'multipart/form-data' }
                                });
                                setWidgetForm(prev => ({...prev, bgImageUrl: res.data.url}));
                              } catch (err) {
                                alert('圖片上傳失敗，請稍後再試');
                              }
                            };
                            input.click();
                          }}
                          className="w-full h-[50px] flex items-center justify-center gap-2 px-4 bg-slate-100 border border-slate-200 border-dashed rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all hover:border-slate-300 shadow-sm"
                        >
                          <ImageIcon size={16} />
                          上傳專屬桌布 (選填)
                        </button>
                      )}
                    </div>
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
                   <div className="flex items-center gap-3">
                     <button
                       type="button"
                       onClick={() => setWidgetForm(f => ({ ...f, showBottomTicker: !f.showBottomTicker }))}
                       className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${widgetForm.showBottomTicker ? 'bg-violet-600 text-white' : 'bg-red-100 text-red-500'}`}
                     >
                       {widgetForm.showBottomTicker ? '✅ 顯示' : '❌ 隱藏'}
                     </button>
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
                        <label className="font-bold text-slate-700 text-sm">新聞停留時間</label>
                        <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded-lg text-slate-500">
                          建議值: 10秒
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[5, 10, 15, 20].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setWidgetForm(f => ({ ...f, marqueeSpeed: s }))}
                            className={`py-2 rounded-xl text-xs font-black transition-all border ${widgetForm.marqueeSpeed === s ? 'bg-violet-600 border-violet-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-violet-400'}`}
                          >
                            {s}秒
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold text-center">每則內容顯示的秒數</p>
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

      <ImageCropperModal
        isOpen={showImageCropper}
        onClose={() => setShowImageCropper(false)}
        imageUrl={editingImage?.url || ''}
        assetName={editingImage?.name || ''}
        onSave={handleSaveCrop}
      />

      <YouTubeAssetModal
        isOpen={showYoutubeModal}
        onClose={() => {
          setShowYoutubeModal(false);
          setEditingYouTubeAsset(null);
        }}
        onSave={handleSaveYouTube}
        initialData={editingYouTubeAsset ? { name: editingYouTubeAsset.name, url: editingYouTubeAsset.url, fixedDuration: editingYouTubeAsset.fixedDuration } : null}
      />

      {/* ──── Preview Modal ──── */}
      {previewAsset && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10 animate-in fade-in duration-300"
          onClick={() => setPreviewAsset(null)}
        >
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" />
          
          <button 
            onClick={() => setPreviewAsset(null)} 
            className="absolute top-4 right-4 sm:top-8 sm:right-8 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all z-[110] border border-white/10"
          >
            <X size={20} />
          </button>

          <div 
            className="relative w-full max-w-6xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-white/10 flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            {previewAsset.type === 'IMAGE' && (
              <img src={previewAsset.url} className="w-full h-full object-contain" alt={previewAsset.name} />
            )}
            
            {previewAsset.type === 'VIDEO' && (
              <video src={previewAsset.url} controls autoPlay className="w-full h-full" />
            )}

            {previewAsset.type === 'WEB' && (
              <iframe src={previewAsset.url} className="w-full h-full border-none bg-white" title={previewAsset.name} />
            )}

            {previewAsset.type === 'YOUTUBE' && (
              <iframe 
                src={`https://www.youtube.com/embed/${getYoutubeId(previewAsset.url)}?autoplay=1`}
                className="w-full h-full border-none"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            )}

            {previewAsset.type === 'CAMPAIGN' && (
              <div className="w-full h-full flex items-center justify-center p-4">
                <div className="w-full h-full max-w-5xl aspect-video rounded-xl overflow-hidden border border-white/20 shadow-2xl relative">
                  {(() => {
                    let config: any = {};
                    try { config = JSON.parse(previewAsset.url || '{}'); } catch {}
                    return (
                      <>
                        <div 
                          className="absolute overflow-hidden"
                          style={{
                            top: `${config.videoRect?.top ?? 0}%`,
                            left: `${config.videoRect?.left ?? 0}%`,
                            width: `${config.videoRect?.width ?? 100}%`,
                            height: `${config.videoRect?.height ?? 100}%`,
                          }}
                        >
                          {config.contentType === 'YOUTUBE' ? (
                            <iframe 
                              src={`https://www.youtube.com/embed/${getYoutubeId(config.youtubeId)}?autoplay=1&mute=1&controls=0`}
                              className="w-full h-full border-none"
                            />
                          ) : (
                            <video src={config.contentUrl} autoPlay muted loop className="w-full h-full object-contain" />
                          )}
                        </div>
                        <img src={config.frameUrl} className="absolute inset-0 w-full h-full object-cover pointer-events-none" alt="Campaign Frame" />
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {previewAsset.type === 'WIDGET' && (
              <div className="w-full h-full bg-slate-900 flex items-center justify-center p-10">
                 <div className="w-full aspect-video scale-90 border-4 border-slate-700 rounded-xl shadow-2xl overflow-hidden bg-slate-950">
                    <WidgetRenderer widgetConfig={(() => {
                      try {
                        return JSON.parse(previewAsset.url);
                      } catch (e) {
                        return { widgetType: 'DASHBOARD', config: {} };
                      }
                    })()} />
                 </div>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
              <h2 className="text-white font-black text-lg sm:text-xl drop-shadow-md">{previewAsset.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-black text-white/50 uppercase tracking-widest border border-white/5">{previewAsset.type} 素材</span>
                {previewAsset.orientation && (
                  <span className="px-2 py-0.5 bg-white/10 rounded text-[9px] font-black text-white/50 uppercase tracking-widest border border-white/5">{previewAsset.orientation}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ Marquee Modal ============ */}
      {showMarqueeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowMarqueeModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6 rounded-t-3xl z-10">
              <h2 className="text-xl font-black">{editingMarquee ? '編輯跑馬燈' : '建立跑馬燈素材'}</h2>
              <p className="text-amber-100 text-sm mt-1">設定跑馬燈的樣式與內容</p>
            </div>
            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">素材名稱</label>
                <input
                  type="text"
                  value={marqueeForm.name}
                  onChange={(e) => setMarqueeForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* 顏色配置 (三段式) */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-6">
                <label className="block text-sm font-black text-slate-700 uppercase tracking-widest">🎨 視覺色彩配置</label>
                
                <div className="grid grid-cols-3 gap-6">
                  {/* Title Block */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-[#0b486b] rounded-full" />
                      <label className="text-[11px] font-black text-slate-500 uppercase">左側標題區</label>
                    </div>
                    <div className="space-y-2">
                       <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                         <span className="text-[10px] font-bold text-slate-400">背景</span>
                         <input type="color" value={marqueeForm.titleBgColor} onChange={(e) => setMarqueeForm(prev => ({ ...prev, titleBgColor: e.target.value }))} className="w-8 h-8 rounded-lg cursor-pointer border-none" />
                       </div>
                       <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                         <span className="text-[10px] font-bold text-slate-400">文字</span>
                         <input type="color" value={marqueeForm.titleTextColor || '#FFFFFF'} onChange={(e) => setMarqueeForm(prev => ({ ...prev, titleTextColor: e.target.value }))} className="w-8 h-8 rounded-lg cursor-pointer border-none" />
                       </div>
                    </div>
                  </div>

                  {/* Body Block */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-slate-300 rounded-full" />
                      <label className="text-[11px] font-black text-slate-500 uppercase">中段內容區</label>
                    </div>
                    <div className="space-y-2">
                       <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                         <span className="text-[10px] font-bold text-slate-400">背景</span>
                         <input type="color" value={marqueeForm.bgColor} onChange={(e) => setMarqueeForm(prev => ({ ...prev, bgColor: e.target.value }))} className="w-8 h-8 rounded-lg cursor-pointer border-none" />
                       </div>
                       <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                         <span className="text-[10px] font-bold text-slate-400">文字</span>
                         <input type="color" value={marqueeForm.textColor || '#000000'} onChange={(e) => setMarqueeForm(prev => ({ ...prev, textColor: e.target.value }))} className="w-8 h-8 rounded-lg cursor-pointer border-none" />
                       </div>
                    </div>
                  </div>

                  {/* Clock Block */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-[#ec6715] rounded-full" />
                      <label className="text-[11px] font-black text-slate-500 uppercase">右側時鐘區</label>
                    </div>
                    <div className="space-y-2">
                       <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                         <span className="text-[10px] font-bold text-slate-400">背景</span>
                         <input type="color" value={marqueeForm.clockBgColor} onChange={(e) => setMarqueeForm(prev => ({ ...prev, clockBgColor: e.target.value }))} className="w-8 h-8 rounded-lg cursor-pointer border-none" />
                       </div>
                       <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100">
                         <span className="text-[10px] font-bold text-slate-400">文字</span>
                         <input type="color" value={marqueeForm.clockTextColor || '#FFFFFF'} onChange={(e) => setMarqueeForm(prev => ({ ...prev, clockTextColor: e.target.value }))} className="w-8 h-8 rounded-lg cursor-pointer border-none" />
                       </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-slate-400 font-black uppercase">🖼️ 進階底圖 (選用)</label>
                    {marqueeForm.bgImageUrl && (
                      <button onClick={() => setMarqueeForm(prev => ({ ...prev, bgImageUrl: null }))} className="text-red-500 hover:text-red-700 text-[10px] font-black uppercase">清除圖片</button>
                    )}
                  </div>
                  <div 
                    className="mt-2 h-12 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-all overflow-hidden"
                    style={{
                      backgroundImage: marqueeForm.bgImageUrl ? `url(${marqueeForm.bgImageUrl})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (e: any) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const compressed = await compressImage(file, 1920, 0.85);
                        const formData = new FormData();
                        formData.append('file', compressed, file.name);
                        try {
                          const res = await api.post('/assets/upload-raw', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                          setMarqueeForm(prev => ({ ...prev, bgImageUrl: res.data.url }));
                        } catch { alert('上傳失敗'); }
                      };
                      input.click();
                    }}
                  >
                    {!marqueeForm.bgImageUrl && <span className="text-slate-400 text-[10px] font-black">點擊上傳自訂底圖</span>}
                  </div>
                </div>
              </div>

              {/* Title Text */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">標題文字</label>
                  <input
                    type="text"
                    value={marqueeForm.title}
                    onChange={(e) => setMarqueeForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="自家屋電子看板"
                  />
                </div>
              </div>

              {/* Content Source */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">內容來源</label>
                <div className="flex gap-2 mb-3">
                  {(['manual', 'news'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setMarqueeForm(prev => ({ ...prev, contentType: t }))}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${marqueeForm.contentType === t ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {t === 'manual' ? '≰️ 自訂文字' : '📰 RSS 新聞'}
                    </button>
                  ))}
                </div>

                {marqueeForm.contentType === 'manual' && (
                  <textarea
                    value={marqueeForm.content}
                    onChange={(e) => setMarqueeForm(prev => ({ ...prev, content: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="輸入跑馬燈文字，每行為一則訊息..."
                  />
                )}
                {marqueeForm.contentType === 'news' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                       {RSS_PRESETS.map(preset => (
                         <button
                           key={preset.url}
                           onClick={() => setMarqueeForm(prev => ({ ...prev, newsUrl: preset.url }))}
                           className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${marqueeForm.newsUrl === preset.url ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-400'}`}
                         >
                           {preset.name}
                         </button>
                       ))}
                    </div>
                    <div className="relative">
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">或自行輸入 RSS 網址：</label>
                       <input
                         type="url"
                         value={marqueeForm.newsUrl}
                         onChange={(e) => setMarqueeForm(prev => ({ ...prev, newsUrl: e.target.value }))}
                         className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                         placeholder="https://example.com/rss"
                       />
                    </div>
                  </div>
                )}
              </div>

              {/* Location Settings (Used for Right Block Weather) */}
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                <label className="block text-[10px] font-black text-blue-900 uppercase tracking-widest mb-3">🌍 地區設定 (用於右側天氣輪播)</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-1">城市名稱</label>
                    <input type="text" value={marqueeForm.city} onChange={(e) => setMarqueeForm(prev => ({ ...prev, city: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold" placeholder="台北市" />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-1">緯度</label>
                    <input type="text" value={marqueeForm.lat} onChange={(e) => setMarqueeForm(prev => ({ ...prev, lat: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold" />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 font-bold block mb-1">經度</label>
                    <input type="text" value={marqueeForm.lon} onChange={(e) => setMarqueeForm(prev => ({ ...prev, lon: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold" />
                  </div>
                </div>
              </div>

              {/* Scroll & Speed */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">滾動效果</label>
                  <button
                    onClick={() => setMarqueeForm(prev => ({ ...prev, scrolling: !prev.scrolling }))}
                    className={`w-full px-4 py-3 rounded-xl font-bold text-sm transition-all ${marqueeForm.scrolling ? 'bg-amber-100 text-amber-700 border-2 border-amber-300' : 'bg-slate-100 text-slate-500 border-2 border-slate-200'}`}
                  >
                    {marqueeForm.scrolling ? '✅ 開啟滾動' : '❌ 靜止顯示'}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">停留時間</label>
                  <select
                    value={marqueeForm.marqueeSpeed}
                    onChange={(e) => setMarqueeForm(prev => ({ ...prev, marqueeSpeed: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={5}>5 秒</option>
                    <option value={10}>10 秒</option>
                    <option value={15}>15 秒</option>
                    <option value={20}>20 秒</option>
                  </select>
                </div>
              </div>

              {/* Clock Toggle */}
              <div className="grid grid-cols-1">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">右側時鐘</label>
                  <button
                    onClick={() => setMarqueeForm(prev => ({ ...prev, showClock: !prev.showClock }))}
                    className={`w-full px-4 py-3 rounded-xl font-bold text-sm transition-all ${marqueeForm.showClock ? 'bg-amber-100 text-amber-700 border-2 border-amber-300' : 'bg-slate-100 text-slate-500 border-2 border-slate-200'}`}
                  >
                    {marqueeForm.showClock ? '✅ 顯示 24h 時鐘' : '❌ 隱藏時鐘'}
                  </button>
                </div>
              </div>

              {/* Live Preview (Slanted Style) */}
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">高品質即時預覽</label>
                <div className="relative w-full h-[60px] rounded-xl overflow-hidden border-2 border-slate-200 bg-black">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: marqueeForm.bgImageUrl ? 'transparent' : marqueeForm.bgColor,
                      backgroundImage: marqueeForm.bgImageUrl ? `url(${marqueeForm.bgImageUrl})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* Title Section (Slanted) */}
                    {marqueeForm.title && (
                      <div 
                        className="absolute left-0 top-0 bottom-0 flex items-center pl-4 pr-10 z-30 shadow-lg" 
                        style={{ 
                          backgroundColor: marqueeForm.titleBgColor,
                          clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0% 100%)'
                        }}
                      >
                        <span className="font-black text-[10px] whitespace-nowrap uppercase tracking-tighter" style={{ color: marqueeForm.titleTextColor }}>{marqueeForm.title}</span>
                      </div>
                    )}
                    
                    {/* Content Section */}
                    <div className="absolute inset-0 flex items-center px-4" style={{ paddingLeft: marqueeForm.title ? '7rem' : '1rem', paddingRight: marqueeForm.showClock ? '6rem' : '1rem' }}>
                      <span className="text-[10px] font-black truncate uppercase" style={{ color: marqueeForm.textColor }}>
                        {marqueeForm.contentType === 'manual'
                          ? (marqueeForm.content || '請輸入內容...')
                          : '新聞標題將在此捲動顯示...'
                        }
                      </span>
                    </div>

                    {/* Clock Section (Slanted) */}
                    {marqueeForm.showClock && (
                      <div 
                        className="absolute right-0 top-0 bottom-0 flex items-center pl-10 pr-4 z-30 shadow-lg"
                        style={{ 
                          backgroundColor: marqueeForm.clockBgColor,
                          clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0% 100%)'
                        }}
                      >
                        <div className="flex flex-col items-center">
                          <span className="font-black text-[10px] tabular-nums" style={{ color: marqueeForm.clockTextColor }}>09:00:00</span>
                          <span className="font-black text-[8px] opacity-70" style={{ color: marqueeForm.clockTextColor }}>台北市 26°C</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => setShowMarqueeModal(false)} className="px-6 py-3 text-slate-500 font-bold rounded-xl hover:bg-slate-100 transition-all">取消</button>
                <button
                  onClick={handleMarqueeSubmit}
                  disabled={marqueeSaving}
                  className="px-8 py-3 bg-amber-600 text-white font-bold rounded-xl shadow-xl hover:bg-amber-700 transition-all disabled:opacity-50"
                >
                  {marqueeSaving ? '儲存中...' : editingMarquee ? '更新跑馬燈' : '建立跑馬燈'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CampaignAssetModal
        isOpen={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        onSave={handleSaveCampaign}
        initialData={editingCampaign}
        availableAssets={assets}
      />
    </div>
  );
}
