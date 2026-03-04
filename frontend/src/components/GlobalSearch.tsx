'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Monitor, FileImage, Calendar, LayoutDashboard } from 'lucide-react';
import api from '@/lib/api';

interface SearchResult {
    screens: any[];
    assets: any[];
    schedules: any[];
}

export function GlobalSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Handle Cmd+F shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                inputRef.current?.focus();
                setIsOpen(true);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    useEffect(() => {
        if (!query.trim()) {
            setResults(null);
            setIsOpen(false);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
                setResults(res.data);
                setIsOpen(true);
            } catch (err) {
                console.error('Search failed', err);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const handleNavigate = (path: string) => {
        router.push(path);
        setIsOpen(false);
        setQuery('');
    };

    const hasResults = results && (results.screens.length > 0 || results.assets.length > 0 || results.schedules.length > 0);

    return (
        <div className="flex-1 max-w-md relative group z-50" ref={wrapperRef}>
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                {loading ? (
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-[#1A5336] rounded-full animate-spin" />
                ) : (
                    <Search size={16} className="text-slate-400 group-focus-within:text-[#1A5336] transition-colors" />
                )}
            </div>
            <input
                ref={inputRef}
                type="text"
                placeholder="搜尋專案、螢幕、素材或排程..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { if (query) setIsOpen(true) }}
                className="w-full pl-11 pr-24 py-2.5 bg-slate-50 border border-transparent focus:bg-white focus:border-[#1A5336]/30 focus:shadow-[0_0_0_4px_rgba(26,83,54,0.05)] rounded-2xl text-sm font-bold transition-all outline-none"
            />
            <div className="absolute inset-y-2 right-2 px-2 bg-white border border-slate-100 rounded-lg flex items-center shadow-sm pointer-events-none">
                <span className="text-[10px] font-black text-slate-400 tracking-tighter">⌘ + F</span>
            </div>

            {/* Dropdown Results */}
            {isOpen && query && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {!loading && !hasResults ? (
                        <div className="p-6 text-center text-slate-400 text-sm font-bold">
                            沒有找到符合「{query}」的結果
                        </div>
                    ) : (
                        <div className="max-h-[60vh] overflow-y-auto p-2">
                            {results?.screens.length ? (
                                <div className="mb-2">
                                    <h3 className="px-3 py-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">依螢幕搜尋</h3>
                                    {results.screens.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => handleNavigate('/screens')}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <Monitor size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{s.name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{s.orientation} • {s.status}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            {results?.assets.length ? (
                                <div className="mb-2">
                                    <h3 className="px-3 py-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">依素材搜尋</h3>
                                    {results.assets.map(a => (
                                        <button
                                            key={a.id}
                                            onClick={() => handleNavigate('/assets')}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center overflow-hidden">
                                                {a.thumbnailUrl ? (
                                                    <img src={a.thumbnailUrl} alt={a.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <FileImage size={14} className="text-purple-600" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{a.name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{a.type}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            {results?.schedules.length ? (
                                <div>
                                    <h3 className="px-3 py-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">依排程搜尋</h3>
                                    {results.schedules.map(sch => (
                                        <button
                                            key={sch.id}
                                            onClick={() => handleNavigate('/schedules')}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                                                <Calendar size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{sch.name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{sch.startTime} - {sch.endTime}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
