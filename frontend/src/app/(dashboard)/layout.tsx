import { SidebarNav } from "@/components/SidebarNav";
import { Monitor, LayoutDashboard } from "lucide-react";

import { GlobalSearch } from "@/components/GlobalSearch";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200/60 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-8 pb-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#1A5336] rounded-2xl flex items-center justify-center shadow-lg shadow-green-900/10">
              <Monitor className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Omni<span className="text-[#1A5336]">screen</span></h1>
          </div>
        </div>

        <SidebarNav />

        {/* <div className="px-4 mt-auto mb-6">
          <div className="bg-gradient-to-br from-[#1A5336] to-[#2D7A51] rounded-3xl p-6 text-white relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <p className="text-xs font-semibold opacity-80 mb-1">全新功能</p>
            <h3 className="text-sm font-bold mb-4">下載行動端 App<br />隨時隨地管理</h3>
            <button className="w-full py-2.5 bg-white text-[#1A5336] text-[11px] font-black rounded-xl hover:bg-opacity-90 transition-all">
              立即下載
            </button>
          </div>
        </div> */}

        {/* This div acts as a spacer to replace the removed component so the profile section stays at the bottom */}
        <div className="mt-auto"></div>

        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center font-bold text-slate-600 overflow-hidden">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User Avatar" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">管理員團隊</p>
              <p className="text-[10px] text-slate-400 font-medium">admin@omni.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/40 px-8 py-4 flex justify-between items-center">
          <GlobalSearch />
          <div className="flex items-center space-x-4">
            <div className="h-8 w-[1px] bg-slate-100 mx-2"></div>
            <span className="text-xs font-bold text-[#22C55E] flex items-center">
              <span className="w-2 h-2 bg-[#22C55E] rounded-full mr-2 animate-pulse"></span>
              系統連線
            </span>
          </div>
        </header>
        <div className="p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

