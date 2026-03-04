'use client';

import { useEffect, useState } from 'react';
import api, { Screen } from '@/lib/api';
import { Monitor, Activity, Layers, Clock, Film, Calendar, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';

interface Stats {
  assetCount: number;
  scheduleCount: number;
  activeScheduleCount: number;
}

export default function Dashboard() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [stats, setStats] = useState<Stats>({ assetCount: 0, scheduleCount: 0, activeScheduleCount: 0 });
  const [loading, setLoading] = useState(true);

  const isOffline = (lastSeen: string) => !lastSeen || Date.now() - new Date(lastSeen).getTime() > 2 * 60 * 1000;
  const formatLastSeen = (lastSeen: string) => {
    if (!lastSeen) return '從未連線';
    const diffMin = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000);
    if (diffMin < 1) return '剛剛';
    if (diffMin < 60) return `${diffMin} 分鐘前`;
    return `${Math.floor(diffMin / 60)} 小時前`;
  };

  const fetchData = async () => {
    try {
      const [screensRes, assetsRes, schedulesRes] = await Promise.all([
        api.get('/screens'),
        api.get('/assets'),
        api.get('/schedules'),
      ]);
      setScreens(screensRes.data);
      const schedules = schedulesRes.data as any[];
      setStats({
        assetCount: assetsRes.data.length,
        scheduleCount: schedules.length,
        activeScheduleCount: schedules.filter((s: any) => s.isActive).length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = screens.filter(s => !isOffline(s.lastSeen)).length;
  const offlineCount = screens.length - onlineCount;

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900">儀表板</h1>
        <p className="text-slate-400 mt-1 font-medium">
          {new Date().toLocaleDateString('zh-TW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="螢幕總數"
          value={loading ? '—' : screens.length}
          icon={<Monitor size={22} />}
          color="bg-white"
        />
        <StatCard
          label="在線中"
          value={loading ? '—' : onlineCount}
          icon={<Wifi size={22} />}
          color="bg-[#1A5336]"
          light
        />
        <StatCard
          label="離線"
          value={loading ? '—' : offlineCount}
          icon={<WifiOff size={22} />}
          color="bg-white"
          highlight={offlineCount > 0}
        />
        <StatCard
          label="素材數"
          value={loading ? '—' : stats.assetCount}
          icon={<Film size={22} />}
          color="bg-white"
        />
      </div>

      {/* Schedule Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white border border-slate-100 rounded-[2rem] p-7 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800">播放排程</h2>
            <Link href="/schedules" className="text-xs font-bold text-[#1A5336] hover:underline flex items-center gap-1">
              管理 <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-slate-50">
              <span className="text-sm font-bold text-slate-500 flex items-center gap-2"><Calendar size={14} />排程總數</span>
              <span className="text-xl font-black text-slate-800">{stats.scheduleCount}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-bold text-slate-500 flex items-center gap-2"><Activity size={14} />已啟用</span>
              <span className="text-xl font-black text-[#1A5336]">{stats.activeScheduleCount}</span>
            </div>
          </div>
          <Link href="/schedules" className="block w-full text-center py-3 rounded-2xl bg-[#1A5336]/5 text-[#1A5336] font-black text-sm hover:bg-[#1A5336]/10 transition-all">
            + 建立新排程
          </Link>
        </div>

        {/* Screen Status Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800">螢幕狀態</h2>
            <Link href="/screens" className="text-xs font-bold text-[#1A5336] hover:underline flex items-center gap-1">
              管理 <ChevronRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-slate-300">
              <Activity className="animate-spin" size={28} />
            </div>
          ) : screens.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[2rem]">
              <Monitor size={32} className="mb-3" />
              <span className="text-sm font-bold">尚無螢幕</span>
              <Link href="/screens" className="mt-3 text-xs font-bold text-[#1A5336]">+ 新增螢幕</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {screens.map(screen => {
                const offline = isOffline(screen.lastSeen);
                return (
                  <div key={screen.id} className={`bg-white border rounded-[1.75rem] p-5 flex items-center gap-4 transition-all ${offline ? 'border-red-100' : 'border-green-100'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${offline ? 'bg-slate-50 text-slate-300' : 'bg-green-50 text-[#1A5336]'}`}>
                      {screen.orientation === 'LANDSCAPE' ? <Monitor size={22} /> : <Layers size={22} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 truncate text-sm">{screen.name}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${offline ? 'text-red-400' : 'text-green-500'}`}>
                        {offline ? `離線 · ${formatLastSeen(screen.lastSeen)}` : `在線 · ${formatLastSeen(screen.lastSeen)}`}
                      </p>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${offline ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-black text-slate-800 mb-5">快速操作</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickAction href="/assets" icon={<Film size={20} />} title="上傳素材" desc="新增圖片或影片到媒體庫" />
          <QuickAction href="/schedules" icon={<Calendar size={20} />} title="建立排程" desc="設定播放時段與優先權" />
          <QuickAction href="/screens" icon={<Monitor size={20} />} title="管理螢幕" desc="新增或監控播放設備" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, light, highlight }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; light?: boolean; highlight?: boolean;
}) {
  const textColor = light ? 'text-white' : highlight ? 'text-red-500' : 'text-slate-900';
  const subColor = light ? 'text-white/60' : 'text-slate-400';
  const iconColor = light ? 'text-white/80' : highlight ? 'text-red-400' : 'text-[#1A5336]';
  return (
    <div className={`${color} border border-slate-100/50 shadow-sm rounded-[2rem] p-7 space-y-3 ${light ? 'shadow-[#1A5336]/10' : ''}`}>
      <div className={iconColor}>{icon}</div>
      <p className={`text-3xl font-black ${textColor}`}>{value}</p>
      <p className={`text-[11px] font-black uppercase tracking-widest ${subColor}`}>{label}</p>
    </div>
  );
}

function QuickAction({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="group flex items-center gap-5 bg-white border border-slate-100 rounded-[1.75rem] p-6 hover:border-[#1A5336]/20 hover:shadow-md transition-all">
      <div className="w-12 h-12 bg-[#1A5336]/5 text-[#1A5336] rounded-2xl flex items-center justify-center group-hover:bg-[#1A5336] group-hover:text-white transition-all flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-black text-slate-800 text-sm">{title}</p>
        <p className="text-[11px] text-slate-400 font-medium mt-0.5">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-slate-300 ml-auto group-hover:text-[#1A5336] transition-colors" />
    </Link>
  );
}
