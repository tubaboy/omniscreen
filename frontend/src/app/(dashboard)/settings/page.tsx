'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Lock, LogOut, Save, KeyRound, Monitor, Eye, Bell, ChevronRight } from 'lucide-react';

type Section = 'security' | 'player' | 'notification' | 'display';

export default function SettingsPage() {
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<Section>('security');

    // Change password state
    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [pwdLoading, setPwdLoading] = useState(false);

    // Player settings (Fetched from API)
    const [pollInterval, setPollInterval] = useState<number>(10);
    const [offlineTimeout, setOfflineTimeout] = useState<number>(2);
    const [hudDefault, setHudDefault] = useState<boolean>(true);
    const [settingsLoading, setSettingsLoading] = useState(true);

    // Notification settings
    const [silentStart, setSilentStart] = useState<number>(0);
    const [silentEnd, setSilentEnd] = useState<number>(8);
    const [alertIntervalMin, setAlertIntervalMin] = useState<number>(30);
    const [alertLoading, setAlertLoading] = useState(false);
    const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        api.get('/settings').then((res) => {
            setPollInterval(parseInt(res.data.player_poll_interval || '10'));
            setOfflineTimeout(parseInt(res.data.offline_timeout_min || '2'));
            setHudDefault(res.data.player_hud !== 'false');
            setSilentStart(parseInt(res.data.alert_silent_start || '0'));
            setSilentEnd(parseInt(res.data.alert_silent_end || '8'));
            setAlertIntervalMin(parseInt(res.data.alert_interval_min || '30'));
        }).finally(() => setSettingsLoading(false));
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('cms_token');
        document.cookie = 'cms_token=; path=/; max-age=0';
        router.replace('/login');
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPwd !== confirmPwd) {
            setPwdMsg({ type: 'error', text: '新密碼與確認密碼不一致' });
            return;
        }
        if (newPwd.length < 6) {
            setPwdMsg({ type: 'error', text: '新密碼至少需要 6 個字元' });
            return;
        }
        setPwdLoading(true);
        try {
            const res = await api.post('/auth/change-password', { currentPassword: currentPwd, newPassword: newPwd });
            setPwdMsg({ type: 'success', text: res.data.message });
            setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
        } catch (err: any) {
            setPwdMsg({ type: 'error', text: err.response?.data?.message || '修改失敗' });
        } finally {
            setPwdLoading(false);
        }
    };

    const savePlayerSettings = async () => {
        try {
            await api.patch('/settings', {
                player_poll_interval: pollInterval.toString(),
                offline_timeout_min: offlineTimeout.toString(),
                player_hud: hudDefault.toString()
            });
            alert('設定已儲存（播放機會在下次輪詢時自動套用）');
        } catch (err) {
            alert('儲存失敗');
        }
    };

    const saveNotificationSettings = async () => {
        try {
            await api.patch('/settings', {
                alert_silent_start: silentStart.toString(),
                alert_silent_end: silentEnd.toString(),
                alert_interval_min: alertIntervalMin.toString(),
            });
            setAlertMsg({ type: 'success', text: '通知設定已儲存' });
        } catch {
            setAlertMsg({ type: 'error', text: '儲存失敗' });
        }
    };

    const sendTestAlert = async () => {
        setAlertLoading(true);
        setAlertMsg(null);
        try {
            await api.post('/settings/test-alert', {});
            setAlertMsg({ type: 'success', text: 'LINE 測試通知已發送！請確認您的 LINE 是否收到訊息。' });
        } catch (err: any) {
            setAlertMsg({ type: 'error', text: err.response?.data?.error || '發送失敗，請確認 LINE Channel Token 是否正確。' });
        } finally {
            setAlertLoading(false);
        }
    };

    const nav: { id: Section; icon: React.ReactNode; label: string }[] = [
        { id: 'security', icon: <Lock size={16} />, label: '帳號安全' },
        { id: 'player', icon: <Monitor size={16} />, label: '播放機行為' },
        { id: 'notification', icon: <Bell size={16} />, label: '通知告警' },
        { id: 'display', icon: <Eye size={16} />, label: '顯示偏好' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-1">偏好設定</h1>
                    <p className="text-slate-400 font-medium">管理帳號、播放機行為與顯示設定</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-5 py-3 bg-white border border-red-100 text-red-400 font-bold text-sm rounded-2xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                >
                    <LogOut size={16} /> 登出
                </button>
            </div>

            <div className="flex gap-8">
                {/* Sidebar Nav */}
                <div className="w-56 flex-shrink-0 space-y-1">
                    {nav.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl font-bold text-sm transition-all
                ${activeSection === item.id
                                    ? 'bg-[#1A5336] text-white shadow-lg shadow-[#1A5336]/20'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                        >
                            <span className="flex items-center gap-3">{item.icon}{item.label}</span>
                            <ChevronRight size={14} className="opacity-50" />
                        </button>
                    ))}
                </div>

                {/* Content Panel */}
                <div className="flex-1 bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">

                    {/* Security Section */}
                    {activeSection === 'security' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 mb-1">帳號安全</h2>
                                <p className="text-sm text-slate-400">修改 CMS 管理員密碼</p>
                            </div>

                            <form onSubmit={handleChangePassword} className="space-y-5 max-w-md">
                                {[
                                    { label: '目前密碼', value: currentPwd, setter: setCurrentPwd },
                                    { label: '新密碼', value: newPwd, setter: setNewPwd },
                                    { label: '確認新密碼', value: confirmPwd, setter: setConfirmPwd },
                                ].map(field => (
                                    <div key={field.label}>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{field.label}</label>
                                        <input
                                            type="password"
                                            value={field.value}
                                            onChange={e => field.setter(e.target.value)}
                                            required
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none"
                                        />
                                    </div>
                                ))}

                                {pwdMsg && (
                                    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold ${pwdMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                        {pwdMsg.text}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={pwdLoading}
                                    className="flex items-center gap-2 px-8 py-4 bg-[#1A5336] text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-[#1A5336]/90 transition-all disabled:opacity-60"
                                >
                                    <KeyRound size={16} /> {pwdLoading ? '處理中...' : '更新密碼'}
                                </button>
                            </form>

                            <div className="border-t border-slate-100 pt-6">
                                <p className="text-xs text-slate-400 font-medium">
                                    ⚠ 密碼更新僅在後端重啟前生效。如需永久更改，請同步修改 <code className="bg-slate-100 px-1.5 py-0.5 rounded">backend/.env</code> 的 <code className="bg-slate-100 px-1.5 py-0.5 rounded">CMS_PASS</code> 值。
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Player Settings Section */}
                    {activeSection === 'player' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 mb-1">播放機行為</h2>
                                <p className="text-sm text-slate-400">這些全域設定將影響所有連接的播放機。播放機每隔一段時間會自動套用新設定。</p>
                            </div>

                            {settingsLoading ? (
                                <div className="text-sm font-bold text-slate-400 animate-pulse">載入中...</div>
                            ) : (
                                <div className="space-y-6 max-w-md">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                            排程輪詢間隔（秒）
                                        </label>
                                        <select
                                            value={pollInterval}
                                            onChange={e => setPollInterval(parseInt(e.target.value))}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none appearance-none"
                                        >
                                            {[5, 10, 30, 60].map(v => <option key={v} value={v}>{v} 秒</option>)}
                                        </select>
                                        <p className="text-[10px] text-slate-400 mt-1.5 ml-1">播放機每隔多久向伺服器確認排程是否更新</p>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                            螢幕離線判定時間
                                        </label>
                                        <select
                                            value={offlineTimeout}
                                            onChange={e => setOfflineTimeout(parseInt(e.target.value))}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none appearance-none"
                                        >
                                            {[1, 2, 5, 10].map(v => <option key={v} value={v}>{v} 分鐘以上視為離線</option>)}
                                        </select>
                                    </div>

                                    <div className="flex items-center justify-between py-4 border-t border-slate-50">
                                        <div>
                                            <p className="font-black text-slate-800 text-sm">播放進度 HUD</p>
                                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">播放機切換素材時顯示底部資訊條</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setHudDefault(prev => !prev)}
                                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all ${hudDefault ? 'bg-[#1A5336]' : 'bg-slate-200'}`}
                                        >
                                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${hudDefault ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    <button
                                        onClick={savePlayerSettings}
                                        className="flex items-center gap-2 px-8 py-4 bg-[#1A5336] text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-[#1A5336]/90 transition-all"
                                    >
                                        <Save size={16} /> 儲存設定
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notification Section */}
                    {activeSection === 'notification' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 mb-1">通知告警</h2>
                                <p className="text-sm text-slate-400">設定螢幕離線時的 LINE 推播通知行為</p>
                            </div>

                            <div className="space-y-6 max-w-md">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                            靜音開始時間
                                        </label>
                                        <select
                                            value={silentStart}
                                            onChange={e => setSilentStart(parseInt(e.target.value))}
                                            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none appearance-none"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                            靜音結束時間
                                        </label>
                                        <select
                                            value={silentEnd}
                                            onChange={e => setSilentEnd(parseInt(e.target.value))}
                                            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none appearance-none"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 -mt-2 ml-1">此時段內不發送 LINE 告警通知（適合店面休息時間）</p>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        持續離線重複發送間隔
                                    </label>
                                    <select
                                        value={alertIntervalMin}
                                        onChange={e => setAlertIntervalMin(parseInt(e.target.value))}
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none appearance-none"
                                    >
                                        {[10, 15, 30, 60, 120, 240, 720].map(v => (
                                            <option key={v} value={v}>每 {v} 分鐘發送一次</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-2 ml-1">若螢幕維持離線狀態，系統會依照此頻率重複發送通知</p>
                                </div>

                                {alertMsg && (
                                    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold ${alertMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                        {alertMsg.text}
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={saveNotificationSettings}
                                        className="flex items-center gap-2 px-6 py-4 bg-[#1A5336] text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-[#1A5336]/90 transition-all"
                                    >
                                        <Save size={16} /> 儲存設定
                                    </button>
                                    <button
                                        onClick={sendTestAlert}
                                        disabled={alertLoading}
                                        className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-60"
                                    >
                                        <Bell size={16} /> {alertLoading ? '發送中...' : '測試 LINE 通知'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Display Preferences */}
                    {activeSection === 'display' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 mb-1">顯示偏好</h2>
                                <p className="text-sm text-slate-400">自訂 CMS 介面外觀</p>
                            </div>

                            <div className="p-6 border border-slate-100 rounded-2xl text-slate-400 text-sm font-medium text-center">
                                🚧 深色模式 / 品牌名稱客製化（即將推出）
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
