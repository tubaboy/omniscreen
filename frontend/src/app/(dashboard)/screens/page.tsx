'use client';

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import api, { Screen } from '@/lib/api';
import ScreenDetailModal from '@/components/ScreenDetailModal';
import {
  Monitor, Plus, Trash2, Smartphone, Check, LayoutGrid, List, Map,
  RefreshCw, Camera, Tag, ChevronDown, X, Activity
} from 'lucide-react';

const MapView = lazy(() => import('@/components/MapView'));

type ViewMode = 'grid' | 'list' | 'map';

export default function ScreenManagement() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [name, setName] = useState('');
  const [orientation, setOrientation] = useState<'LANDSCAPE' | 'PORTRAIT'>('LANDSCAPE');
  const [isAdding, setIsAdding] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailScreen, setDetailScreen] = useState<Screen | null>(null);
  const [filterTag, setFilterTag] = useState('');
  const [batchSending, setBatchSending] = useState(false);

  const fetchScreens = useCallback(async () => {
    try {
      const res = await api.get('/screens');
      setScreens(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const addScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      await api.post('/screens', { name, orientation });
      setName('');
      setIsAdding(false);
      fetchScreens();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteScreen = async (id: string) => {
    if (!confirm('確定要刪除此螢幕嗎？此動作無法復原。')) return;
    try {
      await api.delete(`/screens/${id}`);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      fetchScreens();
    } catch (err) {
      console.error(err);
    }
  };

  const sendBatchCommand = async (type: 'RELOAD' | 'SNAPSHOT' | 'CLEAR_CACHE') => {
    if (selectedIds.size === 0) return;
    setBatchSending(true);
    try {
      await api.post('/commands/batch', {
        type,
        screenIds: Array.from(selectedIds),
      });
      setTimeout(() => setBatchSending(false), 1000);
    } catch (err) {
      console.error(err);
      setBatchSending(false);
    }
  };

  useEffect(() => {
    fetchScreens();
    const interval = setInterval(fetchScreens, 30000);
    return () => clearInterval(interval);
  }, [fetchScreens]);

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

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    screens.forEach(s => s.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [screens]);

  const filteredScreens = useMemo(() => {
    if (!filterTag) return screens;
    return screens.filter(s => s.tags?.includes(filterTag));
  }, [screens, filterTag]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredScreens.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredScreens.map(s => s.id)));
    }
  };

  const onlineCount = screens.filter(s => !isOffline(s.lastSeen)).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">螢幕資產管理</h1>
          <div className="flex items-center gap-4 text-sm font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <Activity size={14} className="text-green-500" />
              <span className="text-green-600">{onlineCount}</span> 在線
            </span>
            <span>·</span>
            <span>{screens.length} 台總計</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggles  */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            {([
              { mode: 'grid' as ViewMode, icon: LayoutGrid },
              { mode: 'list' as ViewMode, icon: List },
              { mode: 'map' as ViewMode, icon: Map },
            ]).map(v => (
              <button
                key={v.mode}
                onClick={() => setViewMode(v.mode)}
                className={`p-2.5 rounded-lg transition-all ${viewMode === v.mode
                  ? 'bg-white text-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'}`}
                title={v.mode === 'grid' ? '網格' : v.mode === 'list' ? '列表' : '地圖'}
              >
                <v.icon size={16} />
              </button>
            ))}
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="relative">
              <select
                value={filterTag}
                onChange={e => setFilterTag(e.target.value)}
                className="appearance-none bg-slate-100 text-sm font-bold text-slate-600 px-4 py-2.5 pr-8 rounded-xl border-0 focus:ring-2 focus:ring-green-200 outline-none cursor-pointer"
              >
                <option value="">全部分組</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}

          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center px-6 py-3 bg-[#1A5336] text-white rounded-xl font-bold shadow-lg shadow-green-900/10 hover:bg-[#1A5336]/90 transition-all"
          >
            <Plus size={18} className="mr-2" />
            新增設備
          </button>
        </div>
      </div>

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-40 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900 text-white rounded-2xl px-6 py-4 shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-white/20 px-3 py-1 rounded-lg text-sm font-black">{selectedIds.size}</span>
              <span className="text-sm font-bold text-white/70">台已選取</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => sendBatchCommand('RELOAD')}
                disabled={batchSending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-300 rounded-xl text-sm font-bold hover:bg-blue-500/30 transition-all disabled:opacity-50"
              >
                <RefreshCw size={14} /> 批量重載
              </button>
              <button
                onClick={() => sendBatchCommand('SNAPSHOT')}
                disabled={batchSending}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all disabled:opacity-50"
              >
                <Camera size={14} /> 批量截圖
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-2 text-white/50 hover:text-white/80 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Screen Form */}
      {isAdding && (
        <div className="bg-white border-2 border-[#1A5336]/10 rounded-[2rem] p-8 shadow-2xl shadow-green-900/5 animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={addScreen} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="block text-sm font-black text-slate-900 uppercase tracking-widest">螢幕別名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="輸入設備名稱 (如: A1 門市主螢幕)"
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none"
                  required
                />
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-black text-slate-900 uppercase tracking-widest">顯示方向</label>
                <div className="flex space-x-4">
                  <OrientationButton
                    active={orientation === 'LANDSCAPE'}
                    onClick={() => setOrientation('LANDSCAPE')}
                    icon={<Monitor size={24} />}
                    label="16:9 橫向"
                  />
                  <OrientationButton
                    active={orientation === 'PORTRAIT'}
                    onClick={() => setOrientation('PORTRAIT')}
                    icon={<Smartphone size={24} />}
                    label="9:16 縱向"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-8 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-10 py-4 bg-[#1A5336] text-white font-black rounded-2xl shadow-lg shadow-green-900/10 hover:bg-[#1A5336]/90 hover:scale-105 active:scale-95 transition-all"
              >
                確認新增
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && (
        <Suspense fallback={<div className="h-[500px] bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-400 font-bold animate-pulse">載入地圖中...</div>}>
          <MapView screens={filteredScreens} onScreenClick={(s) => setDetailScreen(s)} />
        </Suspense>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div>
          {filteredScreens.length > 1 && (
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={toggleSelectAll}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                {selectedIds.size === filteredScreens.length ? '取消全選' : '全選'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredScreens.map((screen) => (
              <div
                key={screen.id}
                className={`bg-white border rounded-[28px] p-6 shadow-sm flex items-center justify-between group transition-all cursor-pointer
                  ${selectedIds.has(screen.id)
                    ? 'border-[#1A5336] ring-2 ring-[#1A5336]/10'
                    : 'border-slate-200/60 hover:border-blue-600/30'}`}
                onClick={() => setDetailScreen(screen)}
              >
                <div className="flex items-center space-x-5">
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(screen.id); }}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all
                      ${selectedIds.has(screen.id)
                        ? 'bg-[#1A5336] border-[#1A5336] text-white'
                        : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    {selectedIds.has(screen.id) && <Check size={14} />}
                  </button>

                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${!isOffline(screen.lastSeen) ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-300'}`}>
                    {screen.orientation === 'LANDSCAPE' ? <Monitor size={28} /> : <Smartphone size={28} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="text-lg font-black text-slate-900">{screen.name}</h3>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${!isOffline(screen.lastSeen) ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}
                        title={!isOffline(screen.lastSeen) ? '在線' : '離線'}
                      />
                      {isOffline(screen.lastSeen) ? (
                        <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-md border border-red-100">
                          OFFLINE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-green-100">
                          ONLINE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                      <span className="font-mono text-[10px] text-slate-400">{screen.id.slice(0, 12)}…</span>
                      <span>·</span>
                      <span>{screen.orientation === 'LANDSCAPE' ? '橫向' : '縱向'}</span>
                      {screen.tags?.length > 0 && (
                        <>
                          <span>·</span>
                          <div className="flex gap-1">
                            {screen.tags.slice(0, 2).map(t => (
                              <span key={t} className="px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded text-[9px] font-bold">
                                {t}
                              </span>
                            ))}
                            {screen.tags.length > 2 && (
                              <span className="text-[9px] text-slate-300">+{screen.tags.length - 2}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Mini snapshot thumbnail */}
                  {screen.lastSnapshotUrl && (
                    <div className="hidden sm:block w-16 h-10 rounded-lg overflow-hidden border border-slate-100 shadow-sm">
                      <img src={screen.lastSnapshotUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="text-right mr-3 hidden sm:block">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-0.5"
                      style={{ color: isOffline(screen.lastSeen) ? '#ef4444' : '#10b981' }}>
                      {isOffline(screen.lastSeen) ? '已離線' : '在線中'}
                    </p>
                    <p className="text-xs font-bold text-slate-500">{formatLastSeen(screen.lastSeen)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteScreen(screen.id); }}
                    className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <button onClick={toggleSelectAll} className="hover:text-slate-600 transition-colors">
                    {selectedIds.size === filteredScreens.length ? '✓ 全選' : '□ 全選'}
                  </button>
                </th>
                <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">名稱</th>
                <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">狀態</th>
                <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">方向</th>
                <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:table-cell">標籤</th>
                <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:table-cell">最後心跳</th>
                <th className="text-right px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredScreens.map((screen) => (
                <tr
                  key={screen.id}
                  className={`border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors ${selectedIds.has(screen.id) ? 'bg-green-50/30' : ''}`}
                  onClick={() => setDetailScreen(screen)}
                >
                  <td className="px-6 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(screen.id); }}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                        ${selectedIds.has(screen.id)
                          ? 'bg-[#1A5336] border-[#1A5336] text-white'
                          : 'border-slate-200'}`}
                    >
                      {selectedIds.has(screen.id) && <Check size={12} />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!isOffline(screen.lastSeen) ? 'bg-green-50 text-green-500' : 'bg-slate-50 text-slate-300'}`}>
                        {screen.orientation === 'LANDSCAPE' ? <Monitor size={16} /> : <Smartphone size={16} />}
                      </div>
                      <span className="font-bold text-slate-800">{screen.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${!isOffline(screen.lastSeen)
                      ? 'bg-green-50 text-green-600 border border-green-100'
                      : 'bg-red-50 text-red-500 border border-red-100'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${!isOffline(screen.lastSeen) ? 'bg-green-500' : 'bg-red-400'}`} />
                      {!isOffline(screen.lastSeen) ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-bold text-slate-500">{screen.orientation === 'LANDSCAPE' ? '橫向' : '縱向'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {screen.tags?.slice(0, 3).map(t => (
                        <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded text-[9px] font-bold">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs font-bold text-slate-400">{formatLastSeen(screen.lastSeen)}</span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteScreen(screen.id); }}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {filteredScreens.length === 0 && !isAdding && (
        <div className="py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-center">
          <p className="text-slate-400 font-bold">{filterTag ? `「${filterTag}」分組無螢幕` : '尚無螢幕資產，請點選右上角新增'}</p>
        </div>
      )}

      {/* Detail Modal */}
      {detailScreen && (
        <ScreenDetailModal
          screen={detailScreen}
          onClose={() => setDetailScreen(null)}
          onUpdate={() => {
            fetchScreens();
            setDetailScreen(null);
          }}
        />
      )}
    </div>
  );
}

function OrientationButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 p-6 border-2 rounded-2xl flex items-center justify-center space-x-3 transition-all ${active ? 'border-[#1A5336] bg-[#E8F5E9] text-[#1A5336] shadow-sm' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}
    >
      {icon}
      <span className="text-sm font-black uppercase tracking-widest">{label}</span>
      {active && <Check size={18} className="ml-auto" />}
    </button>
  );
}
