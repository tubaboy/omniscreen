'use client';

import { useState } from 'react';
import api, { Screen } from '@/lib/api';
import {
  X, RefreshCw, Camera, Trash2, MapPin, Monitor, Smartphone,
  Cpu, Globe, Maximize, Clock, Tag, Send, Loader2, ExternalLink
} from 'lucide-react';

interface ScreenDetailModalProps {
  screen: Screen;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ScreenDetailModal({ screen, onClose, onUpdate }: ScreenDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'location' | 'commands'>('info');
  const [sending, setSending] = useState<string | null>(null);
  const [editName, setEditName] = useState(screen.name);
  const [editTags, setEditTags] = useState(screen.tags?.join(', ') || '');
  const [editLat, setEditLat] = useState(screen.latitude?.toString() || '');
  const [editLng, setEditLng] = useState(screen.longitude?.toString() || '');
  const [saving, setSaving] = useState(false);

  const isOffline = (lastSeen: string) => {
    if (!lastSeen) return true;
    return Date.now() - new Date(lastSeen).getTime() > 2 * 60 * 1000;
  };

  const formatLastSeen = (lastSeen: string) => {
    if (!lastSeen) return '從未連線';
    const diffMs = Date.now() - new Date(lastSeen).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '剛剛';
    if (diffMin < 60) return `${diffMin} 分鐘前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} 小時前`;
    return new Date(lastSeen).toLocaleDateString('zh-TW');
  };

  const sendCommand = async (type: 'RELOAD' | 'SNAPSHOT' | 'CLEAR_CACHE') => {
    setSending(type);
    try {
      await api.post(`/screens/${screen.id}/commands`, { type });
      // Brief delay to show feedback
      setTimeout(() => {
        setSending(null);
        if (type === 'SNAPSHOT') {
          // Wait a few seconds and then refresh to pick up new snapshot
          setTimeout(onUpdate, 5000);
        }
      }, 800);
    } catch (err) {
      console.error(err);
      setSending(null);
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
      await api.patch(`/screens/${screen.id}`, {
        name: editName,
        tags,
        latitude: editLat ? parseFloat(editLat) : null,
        longitude: editLng ? parseFloat(editLng) : null,
      });
      onUpdate();
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const offline = isOffline(screen.lastSeen);
  const sysInfo = screen.systemInfo as Record<string, string> | null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 rounded-t-[2rem] px-8 py-5 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${!offline ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-400'}`}>
              {screen.orientation === 'LANDSCAPE' ? <Monitor size={24} /> : <Smartphone size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">{screen.name}</h2>
                <span className={`w-2.5 h-2.5 rounded-full ${!offline ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
              </div>
              <p className="text-xs text-slate-400 font-mono">{screen.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/player?id=${screen.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#1A5336]/10 text-[#1A5336] rounded-xl font-bold text-sm hover:bg-[#1A5336]/20 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={16} /> <span className="hidden sm:inline">開啟播放器</span>
            </a>
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8 pt-4 flex gap-2">
          {([
            { key: 'info', label: '總覽' },
            { key: 'location', label: '設定' },
            { key: 'commands', label: '遠端控制' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.key
                ? 'bg-[#1A5336] text-white shadow-md shadow-green-900/10'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {activeTab === 'info' && (
            <>
              {/* Snapshot Preview */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">最後截圖</h3>
                {screen.lastSnapshotUrl ? (
                  <div className="relative group">
                    <img
                      src={screen.lastSnapshotUrl}
                      alt="Remote Snapshot"
                      className="w-full rounded-2xl border border-slate-100 shadow-sm"
                    />
                    {screen.snapshotAt && (
                      <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <Clock size={10} />
                        {new Date(screen.snapshotAt).toLocaleString('zh-TW')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
                    <Camera size={32} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm font-bold">尚無截圖</p>
                    <p className="text-slate-300 text-xs mt-1">請至「遠端控制」發送截圖指令</p>
                  </div>
                )}
              </div>

              {/* System Info */}
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">系統資訊</h3>
                {sysInfo ? (
                  <div className="grid grid-cols-2 gap-3">
                    {sysInfo.userAgent && (
                      <div className="col-span-2 bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Globe size={14} className="text-slate-400" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User Agent</span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium break-all">{sysInfo.userAgent}</p>
                      </div>
                    )}
                    {sysInfo.screenWidth && (
                      <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Maximize size={14} className="text-slate-400" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">解析度</span>
                        </div>
                        <p className="text-sm text-slate-700 font-bold">{sysInfo.screenWidth} × {sysInfo.screenHeight}</p>
                      </div>
                    )}
                    {sysInfo.platform && (
                      <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Cpu size={14} className="text-slate-400" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">平台</span>
                        </div>
                        <p className="text-sm text-slate-700 font-bold">{sysInfo.platform}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-6 text-center">
                    <Cpu size={24} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm font-bold">尚無系統資訊</p>
                    <p className="text-slate-300 text-xs mt-1">播放器下次上線時會自動回報</p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {screen.tags && screen.tags.length > 0 && (
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">分組標籤</h3>
                  <div className="flex flex-wrap gap-2">
                    {screen.tags.map(tag => (
                      <span key={tag} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg border border-blue-100">
                        <Tag size={10} className="inline mr-1" />{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">連線狀態</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${!offline ? 'bg-green-500' : 'bg-red-400'}`} />
                    <span className={`text-sm font-bold ${!offline ? 'text-green-600' : 'text-red-500'}`}>
                      {!offline ? '在線中' : '已離線'}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">最後心跳</span>
                  <p className="text-sm font-bold text-slate-700 mt-1">{formatLastSeen(screen.lastSeen)}</p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'location' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">螢幕名稱</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-100 focus:border-[#1A5336] outline-none font-bold transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  <Tag size={12} className="inline mr-1" />分組標籤 (逗號分隔)
                </label>
                <input
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  placeholder="門市, 北區, VIP"
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-100 focus:border-[#1A5336] outline-none font-bold transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                    <MapPin size={12} className="inline mr-1" />緯度
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editLat}
                    onChange={e => setEditLat(e.target.value)}
                    placeholder="25.0330"
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-100 focus:border-[#1A5336] outline-none font-bold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">經度</label>
                  <input
                    type="number"
                    step="any"
                    value={editLng}
                    onChange={e => setEditLng(e.target.value)}
                    placeholder="121.5654"
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-100 focus:border-[#1A5336] outline-none font-bold transition-all"
                  />
                </div>
              </div>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="w-full py-4 bg-[#1A5336] text-white font-black rounded-xl shadow-lg shadow-green-900/10 hover:bg-[#1A5336]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                {saving ? '儲存中...' : '儲存變更'}
              </button>
            </div>
          )}

          {activeTab === 'commands' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 font-medium">向此播放器發送遠端指令，將在下次心跳輪詢時生效。</p>
              <div className="grid grid-cols-1 gap-3">
                {([
                  { type: 'RELOAD' as const, label: '重新載入', desc: '強制播放器重新載入頁面', icon: RefreshCw, color: 'blue' },
                  { type: 'SNAPSHOT' as const, label: '擷取畫面', desc: '要求播放器回傳當前畫面截圖', icon: Camera, color: 'emerald' },
                  { type: 'CLEAR_CACHE' as const, label: '清除快取', desc: '清除播放器的 Service Worker 快取', icon: Trash2, color: 'amber' },
                ]).map(cmd => (
                  <button
                    key={cmd.type}
                    onClick={() => sendCommand(cmd.type)}
                    disabled={sending !== null}
                    className={`w-full p-5 rounded-xl border-2 text-left transition-all hover:shadow-md disabled:opacity-50
                      ${sending === cmd.type
                        ? `border-${cmd.color}-300 bg-${cmd.color}-50`
                        : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                        ${cmd.color === 'blue' ? 'bg-blue-50 text-blue-500' : ''}
                        ${cmd.color === 'emerald' ? 'bg-emerald-50 text-emerald-500' : ''}
                        ${cmd.color === 'amber' ? 'bg-amber-50 text-amber-500' : ''}
                      `}>
                        {sending === cmd.type
                          ? <Loader2 size={22} className="animate-spin" />
                          : <cmd.icon size={22} />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-black text-slate-800">{cmd.label}</h4>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">{cmd.desc}</p>
                      </div>
                      <Send size={16} className="text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick command status */}
              {sending && (
                <div className="text-center py-3">
                  <p className="text-sm text-slate-500 font-bold animate-pulse">指令已發送，等待播放器下次心跳領取...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
