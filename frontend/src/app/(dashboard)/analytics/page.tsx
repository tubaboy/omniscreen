'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, Monitor, Image as ImageIcon, SearchX, Activity, AlertTriangle, Calendar as CalendarIcon, ExternalLink } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { DateRange } from "react-day-picker";
import { format, subDays } from "date-fns";
import { zhTW } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "next/navigation";

// Dynamically import papaparse since it doesn't need to be in the main bundle initially
import Papa from 'papaparse';

interface AssetMetric {
    id: string;
    name: string;
    type: string;
    totalImpressions: number;
    totalDuration: number;
    errorCount: number;
}

interface ScreenMetric {
    id: string;
    name: string;
    status: string;
    lastSeen: string;
    totalPlays: number;
    totalDuration: number;
    errorCount: number;
}

interface ScheduleMetric {
    id: string;
    name: string;
    screenId: string;
    totalPlays: number;
    totalDuration: number;
    errorCount: number;
}

const COLORS = ['#1A5336', '#E8F5E9', '#0d3220', '#4CAF50', '#81C784'];

export default function AnalyticsPage() {
    const router = useRouter();
    const [assetMetrics, setAssetMetrics] = useState<AssetMetric[]>([]);
    const [screenMetrics, setScreenMetrics] = useState<ScreenMetric[]>([]);
    const [scheduleMetrics, setScheduleMetrics] = useState<ScheduleMetric[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [date, setDate] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (date?.from) params.append('startDate', date.from.toISOString());
            if (date?.to) params.append('endDate', date.to.toISOString());

            const queryStr = params.toString() ? `?${params.toString()}` : '';

            const [assetsRes, screensRes, schedulesRes] = await Promise.all([
                api.get(`/analytics/assets${queryStr}`),
                api.get(`/analytics/screens${queryStr}`),
                api.get(`/analytics/schedules${queryStr}`)
            ]);
            console.log('--- Fetched Analytics ---');
            console.table(assetsRes.data);
            setAssetMetrics(assetsRes.data || []);
            setScreenMetrics(screensRes.data || []);
            setScheduleMetrics(schedulesRes.data || []);
        } catch (error) {
            console.error('Failed to fetch analytics', error);
        } finally {
            setLoading(false);
        }
    };

    const exportPDF = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);
        try {
            const dataUrl = await toPng(reportRef.current, {
                quality: 1,
                pixelRatio: 2,
            });

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(dataUrl);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Omniscreen_Analytics_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('PDF Export failed', error);
            alert('匯出 PDF 失敗');
        } finally {
            setIsExporting(false);
        }
    };

    const exportCSV = (type: 'assets' | 'screens' | 'schedules') => {
        try {
            let csvContent = '';
            let filename = '';
            if (type === 'assets') {
                csvContent = Papa.unparse(assetMetrics.map(a => ({
                    '素材名稱': a.name,
                    '類型': a.type,
                    '總曝光次數': a.totalImpressions,
                    '總播放時長(秒)': a.totalDuration,
                    '失敗次數': a.errorCount
                })));
                filename = `Assets_Analytics_${new Date().toISOString().split('T')[0]}.csv`;
            } else if (type === 'screens') {
                csvContent = Papa.unparse(screenMetrics.map(s => ({
                    '螢幕名稱': s.name,
                    '狀態': s.status,
                    '總播放次數': s.totalPlays,
                    '總播放時長(秒)': s.totalDuration,
                    '錯誤次數': s.errorCount,
                    '最後連線時間': new Date(s.lastSeen).toLocaleString()
                })));
                filename = `Screens_Analytics_${new Date().toISOString().split('T')[0]}.csv`;
            } else {
                csvContent = Papa.unparse(scheduleMetrics.map(s => ({
                    '排程名稱': s.name,
                    '總播放次數': s.totalPlays,
                    '總播放時長(秒)': s.totalDuration,
                    '錯誤次數': s.errorCount
                })));
                filename = `Schedules_Analytics_${new Date().toISOString().split('T')[0]}.csv`;
            }

            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error(err);
            alert('匯出 CSV 失敗');
        }
    };

    return (
        <div className="flex-1 overflow-auto bg-slate-50 relative p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">成效報表</h1>
                    <p className="text-slate-500 mt-1">追蹤設備健康度與素材曝光效益</p>
                </div>
                <div className="flex gap-3 items-center flex-wrap sm:justify-end">

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                    "w-[260px] justify-start text-left font-normal bg-white shadow-sm",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                    date.to ? (
                                        <>
                                            {format(date.from, "yyyy/MM/dd")} -{" "}
                                            {format(date.to, "yyyy/MM/dd")}
                                        </>
                                    ) : (
                                        format(date.from, "yyyy/MM/dd")
                                    )
                                ) : (
                                    <span>選擇日期範圍</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-white shadow-xl z-50 border-slate-200" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                                locale={zhTW}
                            />
                        </PopoverContent>
                    </Popover>

                    <Button variant="outline" onClick={() => exportCSV('assets')} disabled={loading}>
                        <Download className="w-4 h-4 mr-2" />
                        匯出資料 (CSV)
                    </Button>
                    <Button
                        className="bg-[#1A5336] hover:bg-[#123925] text-white shadow-md transition-all"
                        onClick={exportPDF}
                        disabled={loading || isExporting}
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        {isExporting ? '匯出中...' : '匯出報表 (PDF)'}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A5336]"></div>
                </div>
            ) : (
                <div className="max-w-7xl mx-auto" ref={reportRef} style={{ background: '#f8fafc', padding: '10px' }}>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <Card className="border-none shadow-sm bg-white hover:shadow-md transition-all">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-slate-500">總曝光數</p>
                                        <p className="text-3xl font-bold font-mono text-[#1A5336]">
                                            {assetMetrics.reduce((acc, a) => acc + a.totalImpressions, 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
                                        <Activity className="w-6 h-6 text-green-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm bg-white hover:shadow-md transition-all">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-slate-500">總播放時長 (分)</p>
                                        <p className="text-3xl font-bold font-mono text-blue-600">
                                            {Math.round(assetMetrics.reduce((acc, a) => acc + a.totalDuration, 0) / 60).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                                        <Monitor className="w-6 h-6 text-blue-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm bg-white hover:shadow-md transition-all">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-slate-500">活躍設備數</p>
                                        <p className="text-3xl font-bold font-mono text-purple-600">
                                            {screenMetrics.filter(s => s.totalPlays > 0).length} / {screenMetrics.length}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center">
                                        <Monitor className="w-6 h-6 text-purple-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm bg-white hover:shadow-md transition-all">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-slate-500">累計錯誤</p>
                                        <p className="text-3xl font-bold font-mono text-rose-600">
                                            {assetMetrics.reduce((acc, a) => acc + a.errorCount, 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                                        <AlertTriangle className="w-6 h-6 text-rose-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Tabs defaultValue="assets" className="w-full">
                        <TabsList className="bg-white/60 p-1 mb-8">
                            <TabsTrigger value="assets" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <ImageIcon className="w-4 h-4" /> 素材效益分析
                            </TabsTrigger>
                            <TabsTrigger value="screens" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Monitor className="w-4 h-4" /> 設備健康度
                            </TabsTrigger>
                            <TabsTrigger value="schedules" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <CalendarIcon className="w-4 h-4" /> 排程數據
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="assets" className="space-y-6">
                            {assetMetrics.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <SearchX className="w-12 h-12 text-slate-300 mb-4" />
                                    <p className="text-slate-500 font-medium">目前沒有足夠的素材播放數據</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Chart 1: Impressions */}
                                    <Card className="border-none shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="text-base">素材曝光次數排行 (Top 10)</CardTitle>
                                            <CardDescription>顯示被播放次數最多的素材</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[300px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={assetMetrics.sort((a, b) => b.totalImpressions - a.totalImpressions).slice(0, 10)} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                        <XAxis
                                                            dataKey="name"
                                                            tick={{ fill: '#64748B', fontSize: 11, dy: 10, dx: -5 }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                            interval={0}
                                                            angle={-45}
                                                            textAnchor="end"
                                                            height={80}
                                                            tickFormatter={(value) => value.length > 20 ? value.substring(0, 20) + '...' : value}
                                                        />
                                                        <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                                        <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Bar
                                                            dataKey="totalImpressions"
                                                            fill="#1A5336"
                                                            radius={[4, 4, 0, 0]}
                                                            name="曝光次數"
                                                            className="cursor-pointer hover:opacity-80 transition-opacity"
                                                            onClick={(data) => {
                                                                // Use the payload id or find it from state based on name if id isn't in payload directly
                                                                const queryStr = `?startDate=${date?.from?.toISOString() || ''}&endDate=${date?.to?.toISOString() || ''}`;
                                                                router.push(`/analytics/assets/${data.id || data.payload?.id}${queryStr}`);
                                                            }}
                                                        />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Chart 2: Play Duration */}
                                    <Card className="border-none shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="text-base">素材播放時長佔比</CardTitle>
                                            <CardDescription>各素材總播放時間 (秒) 分佈</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[300px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={assetMetrics.filter(a => a.totalDuration > 0)}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={60}
                                                            outerRadius={100}
                                                            paddingAngle={5}
                                                            dataKey="totalDuration"
                                                            nameKey="name"
                                                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                                        >
                                                            {assetMetrics.map((entry, index) => (
                                                                <Cell
                                                                    key={`cell-${index}`}
                                                                    fill={COLORS[index % COLORS.length]}
                                                                    className="cursor-pointer hover:opacity-80 transition-opacity outline-none"
                                                                    onClick={() => {
                                                                        const queryStr = `?startDate=${date?.from?.toISOString() || ''}&endDate=${date?.to?.toISOString() || ''}`;
                                                                        router.push(`/analytics/assets/${entry.id}${queryStr}`);
                                                                    }}
                                                                />
                                                            ))}
                                                        </Pie>
                                                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="screens" className="space-y-6">
                            {screenMetrics.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <SearchX className="w-12 h-12 text-slate-300 mb-4" />
                                    <p className="text-slate-500 font-medium">目前沒有足夠的設備數據</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Chart 3: Screen Plays */}
                                    <Card className="border-none shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="text-base">各螢幕播放次數對比</CardTitle>
                                            <CardDescription>檢視哪些設備提供最多的曝光</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[300px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={screenMetrics} layout="vertical" margin={{ left: 20 }}>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                                        <XAxis type="number" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                                        <YAxis dataKey="name" type="category" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                                                        <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Bar dataKey="totalPlays" fill="#4B5563" radius={[0, 4, 4, 0]} name="播放次數" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Chart 4: Screen Errors */}
                                    <Card className="border-none shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="text-base">設備錯誤次數分佈</CardTitle>
                                            <CardDescription>監控播放失敗或異常的設備</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[300px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={screenMetrics.filter(s => s.errorCount >= 0)}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                        <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                                        <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                                        <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Bar dataKey="errorCount" fill="#EF4444" radius={[4, 4, 0, 0]} name="異常次數" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </TabsContent>

                        {/* Schedules Tab */}
                        <TabsContent value="schedules" className="space-y-6">
                            <div className="flex justify-end mb-4">
                                <Button variant="outline" size="sm" onClick={() => exportCSV('schedules')} disabled={loading}>
                                    <Download className="w-4 h-4 mr-2" /> 匯出排程資料
                                </Button>
                            </div>
                            {scheduleMetrics.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <SearchX className="w-12 h-12 text-slate-300 mb-4" />
                                    <p className="text-slate-500 font-medium">目前沒有足夠的排程數據</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card className="border-none shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="text-base">排程執行次數</CardTitle>
                                            <CardDescription>顯示各排程被完整執行的次數總和</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[300px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={scheduleMetrics.sort((a, b) => b.totalPlays - a.totalPlays).slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                                                        <XAxis type="number" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} hide />
                                                        <YAxis dataKey="name" type="category" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                                                        <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Bar
                                                            dataKey="totalPlays"
                                                            fill="#3b82f6"
                                                            radius={[0, 4, 4, 0]}
                                                            name="播放次數"
                                                            className="cursor-pointer hover:opacity-80 transition-opacity"
                                                            onClick={(data) => {
                                                                const queryStr = `?startDate=${date?.from?.toISOString() || ''}&endDate=${date?.to?.toISOString() || ''}`;
                                                                router.push(`/analytics/schedules/${data.id || data.payload?.id}${queryStr}`);
                                                            }}
                                                        />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-none shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="text-base">排程時長與錯誤佔比</CardTitle>
                                            <CardDescription>總播放時數最多的排程</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[300px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={scheduleMetrics.filter(a => a.totalDuration > 0)}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={60}
                                                            outerRadius={100}
                                                            paddingAngle={5}
                                                            dataKey="totalDuration"
                                                            nameKey="name"
                                                            label={({ name, percent }) => `${String(name || 'Unknown').substring(0, 8)} ${((percent || 0) * 100).toFixed(0)}%`}
                                                        >
                                                            {scheduleMetrics.map((entry, index) => (
                                                                <Cell
                                                                    key={`cell-${index}`}
                                                                    fill={COLORS[index % COLORS.length]}
                                                                    className="cursor-pointer hover:opacity-80 transition-opacity outline-none"
                                                                    onClick={() => {
                                                                        const queryStr = `?startDate=${date?.from?.toISOString() || ''}&endDate=${date?.to?.toISOString() || ''}`;
                                                                        router.push(`/analytics/schedules/${entry.id}${queryStr}`);
                                                                    }}
                                                                />
                                                            ))}
                                                        </Pie>
                                                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>

                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                </div>
            )}
        </div>
    );
}
