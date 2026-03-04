'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Image, Monitor, Calendar, Settings } from "lucide-react";
import React from "react";

export function SidebarNav() {
    const pathname = usePathname();

    return (
        <nav className="flex-1 px-4 space-y-1.5">
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">主選單</p>
            <NavItem href="/" icon={<LayoutDashboard size={20} />} label="儀表板" active={pathname === "/"} />
            <NavItem href="/assets" icon={<Image size={20} />} label="素材庫" active={pathname === "/assets"} />
            <NavItem href="/screens" icon={<Monitor size={20} />} label="螢幕管理" active={pathname === "/screens"} />
            <NavItem href="/schedules" icon={<Calendar size={20} />} label="播放排程" active={pathname === "/schedules"} />

            <div className="pt-8">
                <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">系統設定</p>
                <NavItem href="/settings" icon={<Settings size={20} />} label="偏好設定" active={pathname === "/settings"} />
            </div>
        </nav>
    );
}

function NavItem({ href, icon, label, active = false }: { href: string, icon: React.ReactNode, label: string, active?: boolean }) {
    return (
        <Link
            href={href}
            className={`flex items-center justify-between group px-4 py-3 rounded-2xl transition-all duration-200 cursor-pointer ${active
                    ? "bg-[#E8F5E9] text-[#1A5336] shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
        >
            <div className="flex items-center space-x-3">
                <span className={`${active ? "text-[#1A5336]" : "text-slate-400 group-hover:text-slate-600 transition-colors"}`}>
                    {icon}
                </span>
                <span className="text-sm font-bold">{label}</span>
            </div>
            {active && <div className="w-1.5 h-1.5 bg-[#1A5336] rounded-full"></div>}
        </Link>
    );
}
