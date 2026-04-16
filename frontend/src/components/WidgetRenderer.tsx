'use client';

import { useEffect, useState, useRef } from 'react';
import { 
  Sun, 
  CloudSun, 
  Cloud, 
  CloudFog, 
  CloudDrizzle, 
  CloudRain, 
  CloudLowerRain, 
  CloudRainWind, 
  CloudSnow, 
  CloudLightning,
  Droplets,
  Wind,
  Thermometer,
  CalendarDays,
  MapPin,
  RefreshCw
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

export type WidgetType = 'DASHBOARD';

export interface DashboardConfig {
  // Clock
  showDate?: boolean;
  showSeconds?: boolean;
  // Weather
  lat?: number;
  lon?: number;
  city?: string;
  // Announcement
  title?: string;
  content?: string;
  scrolling?: boolean;
  bgColor?: string;
  textColor?: string;
  bgImageUrl?: string | null;
  contentType?: 'manual' | 'news';
  newsUrl?: string;
  marqueeSpeed?: number;
}

export interface WidgetConfig {
  widgetType: WidgetType;
  config: DashboardConfig;
}

// ─── Weather Helpers ──────────────────────────────────────────────────────

const WMO_MAPPING: Record<number, { label: string; Icon: any }> = {
  0: { label: '晴朗', Icon: Sun },
  1: { label: '大致晴朗', Icon: CloudSun },
  2: { label: '局部多雲', Icon: CloudSun },
  3: { label: '陰天', Icon: Cloud },
  45: { label: '有霧', Icon: CloudFog },
  48: { label: '淞霧', Icon: CloudFog },
  51: { label: '輕微毛毛雨', Icon: CloudDrizzle },
  53: { label: '毛毛雨', Icon: CloudDrizzle },
  55: { label: '強烈毛毛雨', Icon: CloudDrizzle },
  61: { label: '小雨', Icon: CloudRain },
  63: { label: '中雨', Icon: CloudRain },
  65: { label: '大雨', Icon: CloudRain },
  71: { label: '小雪', Icon: CloudSnow },
  73: { label: '中雪', Icon: CloudSnow },
  75: { label: '大雪', Icon: CloudSnow },
  80: { label: '陣雨', Icon: CloudDrizzle },
  81: { label: '中度陣雨', Icon: CloudRain },
  82: { label: '強烈陣雨', Icon: CloudRain },
  95: { label: '雷雨', Icon: CloudLightning },
  96: { label: '雷雨伴有冰雹', Icon: CloudLightning },
  99: { label: '強雷雨伴有冰雹', Icon: CloudLightning },
};

interface WeatherData {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    updateTime: string;
  };
  daily: Array<{
    date: string;
    weatherCode: number;
    tempMax: number;
    tempMin: number;
    pop: number; // Probability of precipitation
  }>;
}

// ─── Dashboard Widget (Elegant Signage Style) ──────────────────────────────

function DashboardWidget({ config }: { config: DashboardConfig }) {
  const {
    showDate = true,
    showSeconds = true,
    lat = 25.08, // Default to Neihu area roughly
    lon = 121.57,
    city = '台北市內湖區',
    title = '即時公告',
    content = '',
    scrolling = true,
    bgColor = '#ec5b13', // Primary orange from template
    textColor = '#ffffff',
    contentType = 'manual',
    newsUrl = 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant',
    marqueeSpeed = 40,
  } = config;

  const currentSpeed = Number(marqueeSpeed) || 40;

  // States
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [newsContent, setNewsContent] = useState<string>('');
  const [loadingNews, setLoadingNews] = useState(false);
  const [dynamicDuration, setDynamicDuration] = useState(currentSpeed);
  
  const contentRef = useRef<HTMLDivElement>(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Weather
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTaipei&forecast_days=4`;
        const res = await fetch(url);
        const data = await res.json();
        
        setWeather({
          current: {
            temp: Math.round(data.current.temperature_2m),
            feelsLike: Math.round(data.current.apparent_temperature),
            humidity: data.current.relative_humidity_2m,
            windSpeed: Math.round(data.current.wind_speed_10m),
            weatherCode: data.current.weather_code,
            updateTime: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
          },
          daily: data.daily.time.slice(1).map((time: string, i: number) => ({
            date: time,
            weatherCode: data.daily.weather_code[i+1],
            tempMax: Math.round(data.daily.temperature_2m_max[i+1]),
            tempMin: Math.round(data.daily.temperature_2m_min[i+1]),
            pop: data.daily.precipitation_probability_max[i+1],
          }))
        });
      } catch (e) {
        console.error('Weather error', e);
      }
    };
    fetchWeather();
    const t = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [lat, lon]);

  // News
  useEffect(() => {
    if (contentType !== 'news') return;
    const fetchNews = async () => {
      setLoadingNews(true);
      try {
        // Bypass rss2json discovery cache (FREE tier has 1 hour cache)
        // We add a cache buster to the SOURCE URL itself so the server thinks it's a new request
        const urlObj = new URL(newsUrl);
        urlObj.searchParams.set('_ccb', Date.now().toString());
        const sourceUrlWithBuster = urlObj.toString();
        
        const encodedRssUrl = encodeURIComponent(sourceUrlWithBuster);
        // Add cache-buster to the proxy request as well
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodedRssUrl}&_t=${Date.now()}`);
        const data = await res.json();
        if (data.status === 'ok' && data.items) {
          // Decode simple HTML entities and join titles
          const titles = data.items.map((item: any) => {
            let t = item.title || '';
            // Simple mapping for common RSS HTML entities
            return t.replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .split(' - ')[0];
          }).join(' ｜ ');
          setNewsContent(titles);
        } else {
          setNewsContent('暫時無法獲取新聞資訊，請稍後再試。');
        }
      } catch (e) {
        setNewsContent('新聞讀取服務異常');
      } finally {
        setLoadingNews(false);
      }
    };
    fetchNews();
    const t = setInterval(fetchNews, 10 * 60 * 1000); // Updated from 30m to 10m
    return () => clearInterval(t);
  }, [contentType, newsUrl]);

  const marqueePrefix = (contentType === 'news' && title && title !== '即時公告' && title !== '焦點公告') ? `${title}：` : '';
  const displayContent = contentType === 'news' 
    ? (newsContent || (loadingNews ? '新聞讀取中...' : '')) 
    : (content || '歡迎光臨，祝您有美好的一天！');

  const fullDisplayText = marqueePrefix + displayContent;

  // Dynamic Marquee
  useEffect(() => {
    if (!scrolling || !contentRef.current) {
      setDynamicDuration(currentSpeed);
      return;
    }
    const calculateDuration = () => {
      const contentWidth = contentRef.current?.offsetWidth || 0;
      if (contentWidth > 0) {
        // Screen-relative Calibration: 
        // currentSpeed (15s-180s) represents the time it takes for text to cross ONE screen width (100vw).
        // The animation scrolls 50% of contentWidth (since content is doubled for the loop).
        const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
        const loopDistance = contentWidth / 2;
        const velocity = screenWidth / currentSpeed; // Physical speed: pixels per second
        
        const calculated = loopDistance / velocity;
        setDynamicDuration(Math.max(calculated, 1)); // Realistic floor
      }
    };
    calculateDuration();
    // Re-run if content or speed changes
  }, [scrolling, fullDisplayText, currentSpeed]);

  // UI Formatting
  const timeOptions: Intl.DateTimeFormatOptions = { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  };
  if (showSeconds) {
    timeOptions.second = '2-digit';
  }
  const timeStr = now.toLocaleTimeString('en-US', timeOptions).toUpperCase();
  const [timeMain, timePeriod] = timeStr.split(' ');
  
  // Create components for flashing colon
  const renderTimeWithBlinkingColons = (time: string) => {
    const parts = time.split(':');
    return parts.map((part, i) => (
      <span key={i}>
        {part}
        {i < parts.length - 1 && (
          <span className={`${showSeconds ? 'animate-pulse-fast' : ''} inline-block mx-1`}>:</span>
        )}
      </span>
    ));
  };

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  // Helpers
  const getWeekday = (dateStr: string) => {
    const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const daysTW = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const d = new Date(dateStr);
    return daysTW[d.getDay()];
  };

  const currentWmo = weather ? (WMO_MAPPING[weather.current.weatherCode] ?? { label: '讀取中', Icon: Cloud }) : null;

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col justify-between font-sans text-white bg-black">
      {/* ─── External Assets ─── */}
      <link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
      
      <style>{`
        .font-serif { font-family: 'Playfair Display', serif; }
        .font-display { font-family: 'Public Sans', sans-serif; }
        .glass {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(32px) saturate(180%);
          -webkit-backdrop-filter: blur(32px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
        }
        @keyframes marqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-text {
          display: flex;
          width: max-content;
          animation: marqueeScroll linear infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.1; }
        }
        .animate-pulse-fast {
          animation: blink 1s step-end infinite;
        }
      `}</style>

      {/* ─── Background ─── */}
      <div className="absolute inset-0 z-0">
        <div 
          className="w-full h-full bg-cover bg-center transition-opacity duration-1000"
          style={{ 
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.85)), url('${config.bgImageUrl || '/backgrounds/taipei-neihu.png'}')`,
          }}
        />
      </div>

      {/* ─── Top Section: Time and Date ─── */}
      <div className="relative z-10 flex flex-col items-center pt-20 space-y-1">
        <h1 className="font-serif text-[160px] leading-none tracking-tight drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)] flex items-baseline">
          {renderTimeWithBlinkingColons(timeMain)}
          <span className="text-[50px] font-light opacity-80 uppercase tracking-[0.2em] ml-6">
            {timePeriod}
          </span>
        </h1>
        <div className="h-1 w-20 bg-[#ec5b13] my-4 rounded-full shadow-[0_0_20px_rgba(236,91,19,0.6)]"></div>
        {showDate && (
          <p className="font-serif text-3xl italic tracking-widest text-white/90">
            {dateStr}
          </p>
        )}
      </div>

      {/* ─── Middle Section: Premium Weather Card ─── */}
      <div className="relative z-10 flex justify-center px-12 mb-8">
        <div className="glass rounded-[48px] p-8 flex items-stretch gap-12 max-w-6xl w-full">
          
          {/* Column 1: Current Main */}
          <div className="flex flex-col justify-between min-w-[320px]">
            <div className="flex items-center gap-2 mb-4 opacity-90">
              <MapPin size={18} className="text-[#ec5b13]" />
              <span className="text-2xl font-bold tracking-tight">{city}</span>
            </div>
            
            <div className="flex items-center gap-8 py-2">
              {currentWmo && <currentWmo.Icon size={100} strokeWidth={1.5} className="text-white drop-shadow-md" />}
              <div className="flex flex-col">
                <div className="flex items-start">
                   <span className="text-8xl font-black tracking-tighter">{weather?.current.temp || '--'}</span>
                   <span className="text-4xl mt-3 ml-1">°C</span>
                </div>
                <div className="flex items-center gap-3 mt-1 opacity-80 font-medium">
                  <span className="text-lg">體感溫度: {weather?.current.feelsLike}°C</span>
                </div>
              </div>
            </div>
            
            <div className="mt-4 text-2xl font-medium tracking-wide text-white/90">
              {currentWmo?.label || '讀取中...'}
            </div>
          </div>

          <div className="w-px bg-white/10 my-4" />

          {/* Column 2: Details */}
          <div className="flex flex-col justify-center gap-8 py-2 min-w-[140px]">
            <div className="flex items-center gap-4">
               <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                 <Droplets size={24} className="text-sky-400" />
               </div>
               <div className="flex flex-col">
                 <span className="text-3xl font-bold">{weather?.current.humidity || '--'}<span className="text-lg ml-1 opacity-60">%</span></span>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                 <Wind size={24} className="text-emerald-400" />
               </div>
               <div className="flex flex-col">
                 <span className="text-3xl font-bold">{weather?.current.windSpeed || '--'}<span className="text-lg ml-1 opacity-60">m/s</span></span>
               </div>
            </div>
          </div>

          <div className="w-px bg-white/10 my-4" />

          {/* Column 3: Forecast */}
          <div className="flex-1 flex items-center justify-around gap-4 px-4">
            {weather?.daily.map((day, idx) => {
              const DayWmo = WMO_MAPPING[day.weatherCode] ?? { label: '未知', Icon: Cloud };
              return (
                <div key={idx} className="flex flex-col items-center gap-4 group hover:scale-105 transition-transform duration-300">
                  <span className="text-xl font-bold opacity-80">{getWeekday(day.date)}</span>
                  <div className="bg-white/5 p-4 rounded-3xl border border-white/5 shadow-inner">
                    <DayWmo.Icon size={44} strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex gap-2 font-bold text-xl">
                      <span className="text-white">{day.tempMax}°</span>
                      <span className="text-white/40">{day.tempMin}°</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 rounded-full border border-sky-500/20">
                      <Droplets size={12} className="text-sky-400" />
                      <span className="text-[11px] font-black text-sky-300">{day.pop}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 px-16 flex justify-between items-center opacity-40 text-xs font-bold tracking-widest mb-2 uppercase">
        <div className="flex items-center gap-2">
          <RefreshCw size={12} />
          更新時間: {weather?.current.updateTime || '--:--'}
        </div>
        <div>Open-Meteo Weather Data</div>
      </div>

      {/* ─── Bottom Section: News Ticker ─── */}
      <div className="relative z-20 w-full glass border-x-0 border-b-0 py-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center px-12 h-[80px]">
          {/* Label using the Widget Title */}
          <div className="flex items-center gap-4 pr-12 border-r border-white/20 h-full">
            <Megaphone size={32} className="text-[#ec5b13] animate-bounce" />
            <span className="text-white font-black uppercase tracking-[0.4em] text-xl whitespace-nowrap">
              {title}
            </span>
          </div>
          
          <div className="overflow-hidden flex-1 relative h-full flex items-center pl-12">
            {fullDisplayText && (
              <div 
                key={fullDisplayText}
                className={scrolling ? "animate-marquee-text" : "flex items-center shrink-0"}
                style={scrolling ? { animationDuration: `${dynamicDuration}s` } : {}}
              >
                {[1, (scrolling ? 2 : 1)].map((i) => (
                  <div key={i} ref={i === 1 ? contentRef : null} className="flex items-center shrink-0 pr-[20vw]">
                    <span className="text-4xl font-light tracking-wide whitespace-nowrap inline-flex items-center">
                      {fullDisplayText}
                      {scrolling && <span className="mx-20 text-[#ec5b13] text-2xl">●</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main WidgetRenderer ──────────────────────────────────────────────────

export default function WidgetRenderer({ widgetConfig }: { widgetConfig: WidgetConfig }) {
  if (!widgetConfig || widgetConfig.widgetType !== 'DASHBOARD') return null;
  return <DashboardWidget config={widgetConfig.config} />;
}
