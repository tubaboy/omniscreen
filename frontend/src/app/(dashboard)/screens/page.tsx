'use client';

import { useState, useEffect } from 'react';
import api, { Screen } from '@/lib/api';
import { Monitor, Plus, Trash2, MonitorIcon, Smartphone, Activity, Check } from 'lucide-react';

export default function ScreenManagement() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [name, setName] = useState('');
  const [orientation, setOrientation] = useState<'LANDSCAPE' | 'PORTRAIT'>('LANDSCAPE');
  const [isAdding, setIsAdding] = useState(false);

  const addScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      await api.post('/screens', { name, orientation });
      setName('');
      setIsAdding(false);
      const res = await api.get('/screens');
      setScreens(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteScreen = async (id: string) => {
    if (!confirm('確定要刪除此螢幕嗎？此動作無法復原。')) return;
    try {
      await api.delete(`/screens/${id}`);
      const res = await api.get('/screens');
      setScreens(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchScreens = async () => {
      try {
        const res = await api.get('/screens');
        setScreens(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchScreens();
    // Re-fetch every 30s so offline status stays up to date
    const interval = setInterval(fetchScreens, 30000);
    return () => clearInterval(interval);
  }, []);

  // A screen is considered offline if lastSeen > 2 minutes ago
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

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">螢幕資產管理</h1>
          <p className="text-slate-500 font-medium">配置與監控您的終端顯示設備</p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center px-8 py-4 bg-[#1A5336] text-white rounded-2xl font-bold shadow-xl shadow-green-900/10 hover:bg-[#1A5336]/90 transition-all"
        >
          <Plus size={20} className="mr-3" />
          新增顯示設備
        </button>
      </div>

      {isAdding && (
        <div className="bg-white border-2 border-[#1A5336]/10 rounded-[2.5rem] p-8 shadow-2xl shadow-green-900/5 animate-in fade-in slide-in-from-top-4 duration-300">
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
                    icon={<MonitorIcon size={24} />}
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

      {/* Grid Layout for Screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {screens.map((screen) => (
          <div key={screen.id} className="bg-white border border-slate-200/60 rounded-[32px] p-8 shadow-sm flex items-center justify-between group hover:border-blue-600/30 transition-all">
            <div className="flex items-center space-x-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${!isOffline(screen.lastSeen) ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-300'}`}>
                {screen.orientation === 'LANDSCAPE' ? <MonitorIcon size={32} /> : <Smartphone size={32} />}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-black text-slate-900">{screen.name}</h3>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${!isOffline(screen.lastSeen) ? 'bg-green-500 animate-pulse' : 'bg-red-400'
                      }`}
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
                <div className="flex items-center space-x-3 text-xs font-bold text-slate-400 uppercase tracking-tighter mt-1">
                  <div className="flex items-center space-x-2 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                    <span className="font-mono text-[10px] lowercase text-slate-500">{screen.id}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(screen.id);
                        alert('已複製 ID');
                      }}
                      className="text-slate-400 hover:text-blue-500 transition-colors"
                      title="複製 ID"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                    </button>
                    <button
                      onClick={() => window.open(`/player?id=${screen.id}`, '_blank')}
                      className="text-slate-400 hover:text-green-500 transition-colors"
                      title="在新分頁開啟播放機"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
                    </button>
                  </div>
                  <span>•</span>
                  <span>{screen.orientation === 'LANDSCAPE' ? '橫向' : '縱向'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="text-right mr-4 hidden sm:block">
                <p className="text-[10px] font-black uppercase tracking-widest mb-0.5"
                  style={{ color: isOffline(screen.lastSeen) ? '#ef4444' : '#10b981' }}>
                  {isOffline(screen.lastSeen) ? '已離線' : '在線中'}
                </p>
                <p className="text-sm font-bold text-slate-500">{formatLastSeen(screen.lastSeen)}</p>
              </div>
              <button
                onClick={() => deleteScreen(screen.id)}
                className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}

        {screens.length === 0 && !isAdding && (
          <div className="col-span-full py-20 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-bold">尚無螢幕資產，請點選右上角新增</p>
          </div>
        )}
      </div>
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
