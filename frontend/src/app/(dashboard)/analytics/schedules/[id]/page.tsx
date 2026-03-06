"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText, Monitor, Clock, PlayCircle, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import Papa from 'papaparse';

interface ScheduleInfo {
    id: string;
    name: string;
    screenName: string;
}

interface DailyTrend {
    date: string;
    plays: number;
    duration: number;
}

interface AssetDistribution {
    assetId: string;
    name: string;
    type: string;
    plays: number;
    duration: number;
}

interface ScheduleDetails {
    schedule: ScheduleInfo;
    totalPlays: number;
    totalDuration: number;
    errorCount: number;
    dailyTrend: DailyTrend[];
    assetDistribution: AssetDistribution[];
}

const COLORS = ['#1A5336', '#E8F5E9', '#0d3220', '#4CAF50', '#81C784', '#A5D6A7', '#C8E6C9'];

export default function ScheduleAnalyticsDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    const scheduleId = params.id as string;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const [details, setDetails] = useState<ScheduleDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scheduleId) {
            fetchScheduleDetails();
        }
    }, [scheduleId, startDate, endDate]);

    const fetchScheduleDetails = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (startDate) queryParams.append('startDate', startDate);
            if (endDate) queryParams.append('endDate', endDate);

            const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

            const res = await api.get(`/analytics/schedules/${scheduleId}${queryStr}`);
            setDetails(res.data);
        } catch (error) {
            console.error('Failed to fetch schedule details', error);
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = () => {
        if (!details) return;

        const csvData = [
            ['Schedule Name', details.schedule.name],
            ['Screen Name', details.schedule.screenName],
            [],
            ['Date', 'Plays', 'Duration (seconds)'],
            ...details.dailyTrend.map(d => [d.date, d.plays.toString(), d.duration.toString()]),
            [],
            ['Asset Name', 'Asset Type', 'Plays', 'Duration (seconds)'],
            ...details.assetDistribution.map(a => [a.name, a.type, a.plays.toString(), a.duration.toString()])
        ];

        const csv = Papa.unparse(csvData);
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `schedule_report_${details.schedule.name}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportPDF = async () => {
        if (!reportRef.current || !details) return;
        setIsExporting(true);
        try {
            const canvas = await toPng(reportRef.current, { backgroundColor: '#f8fafc', pixelRatio: 2 });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (reportRef.current.offsetHeight * pdfWidth) / reportRef.current.offsetWidth;
            pdf.addImage(canvas, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`schedule_report_${details.schedule.name}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Error generating PDF', error);
            alert('PDF 匯出失敗，請稍後再試。');
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A5336]"></div>
            </div>
        );
    }

    if (!details) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-50">
                <AlertTriangle className="w-16 h-16 text-slate-300 mb-4" />
                <h2 className="text-xl font-semibold text-slate-700">找不到排程分析資料</h2>
                <Button variant="link" onClick={() => router.back()} className="mt-4">
                    返回上一頁
                </Button>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto bg-slate-50 relative p-8">
            <div className="max-w-5xl mx-auto mb-8">
                <Button variant="ghost" className="mb-4 -ml-4 text-slate-500 hover:text-slate-900" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> 回到上一頁
                </Button>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{details.schedule.name}</h1>
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full flex items-center gap-1">
                                <Monitor size={12} /> {details.schedule.screenName}
                            </span>
                        </div>
                        <p className="text-slate-500 mt-1">單一排程詳細成效報告</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={exportCSV} disabled={isExporting}>
                            <Download className="w-4 h-4 mr-2" />
                            匯出資料 (CSV)
                        </Button>
                        <Button
                            className="bg-[#1A5336] hover:bg-[#123925] text-white shadow-md transition-all"
                            onClick={exportPDF}
                            disabled={isExporting}
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            {isExporting ? '匯出中...' : '匯出專屬報表 (PDF)'}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto space-y-6" ref={reportRef} style={{ background: '#f8fafc', padding: '10px' }}>
                {/* Stats row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-none shadow-sm bg-white">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-slate-500">總播放次數</p>
                                    <p className="text-3xl font-bold font-mono text-slate-900">{details.totalPlays.toLocaleString()}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                                    <PlayCircle className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-slate-500">總播放時長 (秒)</p>
                                    <p className="text-3xl font-bold font-mono text-[#1A5336]">{Math.round(details.totalDuration).toLocaleString()}</p>
                                </div>
                                <div className="w-12 h-12 bg-[#E8F5E9] rounded-2xl flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-[#1A5336]" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-slate-500">錯誤次數</p>
                                    <p className="text-3xl font-bold font-mono text-rose-600">{details.errorCount.toLocaleString()}</p>
                                </div>
                                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-rose-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Daily Trend */}
                    <Card className="border-none shadow-sm lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base">每日播放趨勢</CardTitle>
                            <CardDescription>排程每日被成功播放的總次數</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                {details.dailyTrend.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={details.dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fill: '#64748B', fontSize: 12 }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(str) => str.substring(5)} // Show MM-DD
                                            />
                                            <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                            <RechartsTooltip cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Line type="monotone" dataKey="plays" stroke="#1A5336" strokeWidth={3} dot={{ fill: '#1A5336', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} name="播放次數" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-slate-400">目前沒有資料</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Asset Distribution Bar */}
                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base">涵蓋素材播放次數</CardTitle>
                            <CardDescription>排程內各素材的播放比較</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                {details.assetDistribution.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={details.assetDistribution.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                                            <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Bar dataKey="plays" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="播放次數" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-slate-400">目前沒有資料</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Asset Duration Pie */}
                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base">涵蓋素材時長佔比</CardTitle>
                            <CardDescription>各素材在總播放時數中的佔比</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                {details.assetDistribution.filter(a => a.duration > 0).length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={details.assetDistribution.filter(a => a.duration > 0)}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="duration"
                                                nameKey="name"
                                                label={({ name, percent }) => `${String(name || 'Unknown').substring(0, 10)} ${((percent || 0) * 100).toFixed(0)}%`}
                                            >
                                                {details.assetDistribution.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-slate-400">目前沒有資料</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
