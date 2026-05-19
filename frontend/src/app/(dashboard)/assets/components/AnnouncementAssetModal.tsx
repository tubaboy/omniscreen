'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Plus, Trash2, Move, Type, Settings2 } from 'lucide-react';
import api, { fixUrl } from '@/lib/api';

interface TextLayer {
  id: string;
  content: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  fontSize: number; // percentage relative to container height (e.g. 5 means 5vh)
  color: string;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right';
}

interface AnnouncementAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  existingAsset?: any;
}

export default function AnnouncementAssetModal({ isOpen, onClose, onSaved, existingAsset }: AnnouncementAssetModalProps) {
  const [name, setName] = useState('');
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState<string>('#000000');
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [duration, setDuration] = useState<number>(30);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<boolean>(false);
  const dragStartOffset = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      if (existingAsset) {
        setName(existingAsset.name || '');
        setDuration(existingAsset.duration || 30);
        try {
          const config = JSON.parse(existingAsset.url || '{}');
          setBgImageUrl(fixUrl(config.bgImageUrl) || null);
          setBgColor(config.bgColor || '#000000');
          setTexts(config.texts || []);
        } catch (e) {
          console.error('Failed to parse announcement config', e);
        }
      } else {
        setName('');
        setBgImageUrl(null);
        setBgColor('#000000');
        setTexts([]);
        setDuration(30);
      }
      setSelectedTextId(null);
    }
  }, [isOpen, existingAsset]);

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/assets/upload-raw', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBgImageUrl(fixUrl(res.data.url));
    } catch (err) {
      console.error('Upload failed:', err);
      alert('上傳失敗');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddText = () => {
    const newText: TextLayer = {
      id: Math.random().toString(36).substring(7),
      content: '輸入公告內容',
      x: 50,
      y: 50,
      fontSize: 8, // 8% of container height
      color: '#FFFFFF',
      fontWeight: 'bold',
      textAlign: 'center',
    };
    setTexts(prev => [...prev, newText]);
    setSelectedTextId(newText.id);
  };

  const handleTextChange = (id: string, field: keyof TextLayer, value: any) => {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleDeleteText = (id: string) => {
    setTexts(prev => prev.filter(t => t.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  // Pointer Event Handlers for Dragging
  const onPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation(); // prevent container click
    setSelectedTextId(id);
    
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const textLayer = texts.find(t => t.id === id);
    if (!textLayer) return;

    isDragging.current = true;
    // Calculate offset relative to the center of the text element
    const xPx = (textLayer.x / 100) * rect.width;
    const yPx = (textLayer.y / 100) * rect.height;
    
    dragStartOffset.current = {
      x: e.clientX - rect.left - xPx,
      y: e.clientY - rect.top - yPx,
    };
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !selectedTextId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    const xPx = e.clientX - rect.left - dragStartOffset.current.x;
    const yPx = e.clientY - rect.top - dragStartOffset.current.y;
    
    let xPct = (xPx / rect.width) * 100;
    let yPct = (yPx / rect.height) * 100;

    // Constrain to container
    xPct = Math.max(0, Math.min(100, xPct));
    yPct = Math.max(0, Math.min(100, yPct));

    handleTextChange(selectedTextId, 'x', xPct);
    handleTextChange(selectedTextId, 'y', yPct);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
      isDragging.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // Keyboard Event Handlers for Dragging/Deleting
  useEffect(() => {
    if (!isOpen || !selectedTextId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tagName = document.activeElement?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;
      
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDeleteText(selectedTextId);
        return;
      }

      const step = e.shiftKey ? 5 : 1;
      const textLayer = texts.find(t => t.id === selectedTextId);
      if (!textLayer) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        let newX = textLayer.x;
        let newY = textLayer.y;
        if (e.key === 'ArrowUp') newY = Math.max(0, textLayer.y - step);
        if (e.key === 'ArrowDown') newY = Math.min(100, textLayer.y + step);
        if (e.key === 'ArrowLeft') newX = Math.max(0, textLayer.x - step);
        if (e.key === 'ArrowRight') newX = Math.min(100, textLayer.x + step);
        
        handleTextChange(selectedTextId, 'x', newX);
        handleTextChange(selectedTextId, 'y', newY);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedTextId, texts]);

  const handleSave = async () => {
    if (!name) return alert('請輸入素材名稱');
    setIsSaving(true);
    
    const config = {
      bgImageUrl,
      bgColor,
      texts,
      duration,
      fixedDuration: true
    };

    try {
      if (existingAsset) {
        await api.patch(`/assets/${existingAsset.id}`, { name, config, duration });
      } else {
        await api.post('/assets/announcement', { name, config });
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedText = texts.find(t => t.id === selectedTextId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[90vw] h-[90vh] max-w-6xl bg-[#1c1c1e] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#2c2c2e]/50">
          <h2 className="text-xl font-medium text-white">{existingAsset ? '編輯公告模板' : '新增公告模板'}</h2>
          <button onClick={onClose} className="p-2 text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Preview / Canvas */}
          <div className="flex-1 p-6 bg-black flex items-center justify-center relative select-none">
            
            <div 
              ref={containerRef}
              className="w-full aspect-video relative overflow-hidden shadow-2xl rounded-lg border border-white/5"
              style={{ backgroundColor: bgColor }}
              onPointerDown={() => setSelectedTextId(null)}
            >
              {bgImageUrl && (
                <img 
                  src={bgImageUrl} 
                  alt="Background" 
                  className="w-full h-full object-contain pointer-events-none"
                />
              )}
              
              {/* Text Layers */}
              {texts.map(text => (
                <div
                  key={text.id}
                  className={`absolute group cursor-move -translate-x-1/2 -translate-y-1/2 transition-shadow duration-100
                    ${selectedTextId === text.id ? 'ring-2 ring-blue-500 rounded-sm' : 'hover:ring-1 hover:ring-white/50 rounded-sm'}
                  `}
                  style={{
                    left: `${text.x}%`,
                    top: `${text.y}%`,
                    fontSize: `${text.fontSize}cqh`, // use container query height if defined, fallback to vh below
                    color: text.color,
                    fontWeight: text.fontWeight,
                    textAlign: text.textAlign,
                    whiteSpace: 'pre-wrap',
                    textShadow: '0px 2px 4px rgba(0,0,0,0.5)',
                    WebkitTextStroke: text.fontWeight === '900' ? '0.04em currentColor' : undefined,
                    fontFamily: '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif'
                  }}
                  onPointerDown={(e) => onPointerDown(e, text.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                >
                  {/* Provide inline container query style to wrapper */}
                  <div style={{ fontSize: `calc(100cqh * ${text.fontSize / 100})`, lineHeight: 1.2 }}>
                    {text.content || '空'}
                  </div>
                </div>
              ))}
              
              {/* Force aspect-video to have container type for text scaling */}
              <style>{`
                div[style*="background-color"] { container-type: size; }
              `}</style>
            </div>
            
            <div className="absolute top-4 right-4 flex gap-2">
              <label className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full cursor-pointer backdrop-blur transition-colors text-sm">
                <Upload size={16} />
                {isUploading ? '上傳中...' : '更換背景圖'}
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadBg} />
              </label>
              <button 
                onClick={handleAddText}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full cursor-pointer backdrop-blur transition-colors shadow-lg text-sm"
              >
                <Type size={16} />
                新增文字
              </button>
            </div>
          </div>

          {/* Right Panel: Controls */}
          <div className="w-[360px] bg-[#2c2c2e] border-l border-white/10 flex flex-col">
            <div className="p-6 flex-1 overflow-y-auto space-y-8">
              
              <div className="space-y-4">
                <h3 className="text-white/80 font-medium text-sm uppercase tracking-wider flex items-center gap-2">
                  <Settings2 size={16}/> 基本設定
                </h3>
                <div className="space-y-2">
                  <label className="text-sm text-white/60">素材名稱</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-black/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="例如：春節休假公告"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/60">預設背景顏色 <span className="text-white/40 text-xs">(適用於透明 PNG 背景)</span></label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={e => setBgColor(e.target.value)}
                      className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={bgColor}
                      onChange={e => setBgColor(e.target.value)}
                      className="flex-1 bg-black/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-blue-500 focus:outline-none uppercase"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/60">播放秒數</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    min={1}
                    className="w-full bg-black/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {selectedText && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white/80 font-medium text-sm uppercase tracking-wider flex items-center gap-2">
                      <Type size={16}/> 文字編輯
                    </h3>
                    <button 
                      onClick={() => handleDeleteText(selectedText.id)}
                      className="text-red-400 hover:text-red-300 p-1"
                      title="刪除文字"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-white/60">內容</label>
                    <textarea
                      value={selectedText.content}
                      onChange={e => handleTextChange(selectedText.id, 'content', e.target.value)}
                      className="w-full bg-black/50 text-white rounded-xl px-4 py-3 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors h-24 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/60 flex justify-between">
                      <span>字體大小</span>
                      <span className="text-white/40">{selectedText.fontSize}</span>
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="30"
                      step="1"
                      value={selectedText.fontSize}
                      onChange={e => handleTextChange(selectedText.id, 'fontSize', Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/60">文字顏色</label>
                    <div className="flex gap-2 flex-wrap">
                      {['#FFFFFF', '#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'].map(c => (
                        <button
                          key={c}
                          onClick={() => handleTextChange(selectedText.id, 'color', c)}
                          className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${selectedText.color === c ? 'border-blue-500 scale-110' : 'border-white/10'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <label className="w-8 h-8 rounded-full border-2 border-white/10 cursor-pointer overflow-hidden relative" title="自訂顏色">
                        <input 
                          type="color" 
                          value={selectedText.color} 
                          onChange={e => handleTextChange(selectedText.id, 'color', e.target.value)}
                          className="absolute inset-[-10px] w-12 h-12 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-white/60">粗細</label>
                    <div className="flex gap-2">
                      {['normal', 'bold', '900'].map(w => (
                        <button
                          key={w}
                          onClick={() => handleTextChange(selectedText.id, 'fontWeight', w)}
                          className={`flex-1 py-2 rounded-xl text-sm transition-colors border ${selectedText.fontWeight === w ? 'bg-white/20 border-white/40 text-white' : 'bg-black/30 border-white/10 text-white/60 hover:bg-white/10'}`}
                        >
                          {w === 'normal' ? '標準' : w === 'bold' ? '粗體' : '極粗'}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <p className="text-xs text-white/40 pt-2 flex items-center gap-1">
                    <Move size={12}/> 在左側預覽區直接拖曳即可移動位置
                  </p>
                </div>
              )}
            </div>
            
            {/* Action Bar */}
            <div className="p-6 border-t border-white/10 bg-[#2c2c2e]">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? '儲存中...' : '儲存公告模板'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
