'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // If already logged in, redirect to dashboard
    useEffect(() => {
        const token = localStorage.getItem('cms_token');
        if (token) router.replace('/');
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/login', { username, password });
            const token = res.data.token;
            localStorage.setItem('cms_token', token);
            // Also write to cookie for Next.js middleware route protection
            document.cookie = `cms_token=${token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
            router.replace('/');
        } catch (err: any) {
            setError(err.response?.data?.message || '登入失敗，請稍後再試');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-green-50/30">
            <div className="w-full max-w-md px-6">
                {/* Logo Area */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1A5336] rounded-3xl shadow-2xl shadow-green-900/20 mb-6">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900">OmniScreen</h1>
                    <p className="text-slate-400 font-medium mt-1 text-sm">內容管理系統</p>
                </div>

                {/* Login Card */}
                <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-10">
                    <h2 className="text-xl font-black text-slate-800 mb-8">登入管理後台</h2>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                帳號
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="admin"
                                required
                                autoComplete="username"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                密碼
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
                                <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0" />
                                <p className="text-red-600 text-sm font-bold">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 mt-2 bg-[#1A5336] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-green-900/20 hover:bg-[#1A5336]/90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? '驗證中...' : '登入'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-slate-300 font-medium mt-8">
                    OmniScreen CMS · 僅限授權人員使用
                </p>
            </div>
        </div>
    );
}
