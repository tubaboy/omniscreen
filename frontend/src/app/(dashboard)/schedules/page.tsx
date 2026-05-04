'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api, { Screen, Asset } from '@/lib/api';

// Lightweight unique ID generator (no dependency needed)
let _uidCounter = 0;
const uid = () => `q_${Date.now().toString(36)}_${(++_uidCounter).toString(36)}`;
import {
  Calendar,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  Edit2,
  Activity,
  Monitor,
  GripVertical,
  X,
  ListOrdered,
  ImageIcon,
  Film,
  BarChart3,
  Maximize2,
  Megaphone,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface LayoutConfig {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Schedule {
  id: string;
  name: string;
  screenId: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  priority: number;
  startDate: string | null;
  endDate: string | null;
  frameId?: string | null;
  frame?: Asset | null;
  layoutConfig?: LayoutConfig | null;
  marqueeConfig?: any;
  screen: Screen;
  items: { asset: Asset }[];
}

// ── Queue item type with unique key ────────────────────────────────────────────
interface QueueItem {
  queueKey: string; // unique per queue slot, allows same asset multiple times
  asset: Asset;
  durationForSchedule?: number;
}

// ── SortableQueueItem ──────────────────────────────────────────────────────────
function SortableQueueItem({
  item,
  index,
  onRemove,
  onDurationChange,
}: {
  item: QueueItem;
  index: number;
  onRemove: (queueKey: string) => void;
  onDurationChange: (queueKey: string, duration: number) => void;
}) {
  const { asset } = item;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.queueKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const thumb = asset.thumbnailUrl || (asset.type === 'IMAGE' ? asset.url : null);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-3 group select-none"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        aria-label="拖拉重新排序"
      >
        <GripVertical size={18} />
      </button>

      {/* Order badge */}
      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-400 flex-shrink-0">
        {index + 1}
      </span>

      {/* Thumbnail */}
      <div className="w-12 h-8 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 relative">
        {thumb ? (
          <img src={thumb} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <Film size={14} />
          </div>
        )}
        {/* Orientation Badge */}
        <div className="absolute bottom-0 left-0 flex items-center bg-black/60 text-white text-[8px] font-black px-1 rounded-tr-md backdrop-blur-sm pointer-events-none gap-1">
          <span>{asset.type === 'VIDEO' ? 'VIDEO' : 'IMAGE'}</span>
          <span className="opacity-50">|</span>
          <span>{asset.orientation === 'PORTRAIT' ? '9:16' : (asset.orientation === 'PORTRAIT_34' ? '3:4' : (asset.orientation === 'LANDSCAPE_43' ? '4:3' : '16:9'))}</span>
        </div>
      </div>

      {/* Name */}
      <p className="flex-1 text-xs font-bold text-slate-700 truncate">{asset.name}</p>

      {/* Duration Input for Images, Widgets, Web and YouTube Assets */}
      {(asset.type === 'IMAGE' || asset.type === 'WIDGET' || asset.type === 'WEB' || asset.type === 'YOUTUBE') && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Clock size={12} className="text-slate-400" />
          <input
            type="number"
            min="1"
            className="w-14 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-center"
            value={item.durationForSchedule || asset.duration || 120}
            onChange={(e) => onDurationChange(item.queueKey, parseInt(e.target.value) || 10)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()} // 防止被 dnd-kit 攔截
            title="播放秒數"
          />
          <span className="text-[10px] font-bold text-slate-400">秒</span>
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={() => onRemove(item.queueKey)}
        className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
        aria-label="從佇列移除"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── DragOverlay ghost card ─────────────────────────────────────────────────────
function DragGhostCard({ asset }: { asset: Asset | null }) {
  if (!asset) return null;
  const thumb = asset.thumbnailUrl || (asset.type === 'IMAGE' ? asset.url : null);
  return (
    <div className="flex items-center gap-3 bg-white border-2 border-blue-400 rounded-2xl p-3 shadow-2xl shadow-blue-200/50 rotate-1 scale-105">
      <GripVertical size={18} className="text-blue-400" />
      <div className="w-12 h-8 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 relative">
        {thumb ? (
          <img src={thumb} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <Film size={14} />
          </div>
        )}
        <div className="absolute bottom-0 left-0 flex items-center bg-black/60 text-white text-[8px] font-black px-1 rounded-tr-md backdrop-blur-sm pointer-events-none gap-1">
          <span>{asset.type === 'VIDEO' ? 'VIDEO' : 'IMAGE'}</span>
          <span className="opacity-50">|</span>
          <span>{asset.orientation === 'PORTRAIT' ? '9:16' : (asset.orientation === 'PORTRAIT_34' ? '3:4' : (asset.orientation === 'LANDSCAPE_43' ? '4:3' : '16:9'))}</span>
        </div>
      </div>
      <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{asset.name}</p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ScheduleManagement() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [transition, setTransition] = useState('FADE');
  const [frameId, setFrameId] = useState<string>('');
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null);
  // Marquee config
  const [marqueeEnabled, setMarqueeEnabled] = useState(false);
  const [marqueeItems, setMarqueeItems] = useState<{assetId: string; duration: number}[]>([]);
  const [marqueeTransition, setMarqueeTransition] = useState('FADE');
  // Queue: ordered array of asset objects with optional duration override
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isActive, setIsActive] = useState(true);

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [isLayoutDragging, setIsLayoutDragging] = useState(false);
  const [isLayoutResizing, setIsLayoutResizing] = useState(false);
  const [layoutDragStart, setLayoutDragStart] = useState({ x: 0, y: 0, top: 0, left: 0, width: 0, height: 0 });

  const handleLayoutMouseDown = (e: React.MouseEvent, type: 'move' | 'resize') => {
    e.preventDefault();
    const container = document.getElementById('layout-preview-container')?.getBoundingClientRect();
    if (!container) return;
    
    if (type === 'move') setIsLayoutDragging(true);
    else setIsLayoutResizing(true);
    
    const current = layoutConfig || { top: 0, left: 0, width: 100, height: 100 };
    setLayoutDragStart({
      x: e.clientX,
      y: e.clientY,
      top: current.top,
      left: current.left,
      width: current.width,
      height: current.height
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isLayoutDragging && !isLayoutResizing) return;
      const container = document.getElementById('layout-preview-container')?.getBoundingClientRect();
      if (!container) return;

      const dx = ((e.clientX - layoutDragStart.x) / container.width) * 100;
      const dy = ((e.clientY - layoutDragStart.y) / container.height) * 100;

      if (isLayoutDragging) {
        setLayoutConfig(prev => {
          const current = prev || { top: 0, left: 0, width: 100, height: 100 };
          return {
            ...current,
            left: Math.max(0, Math.min(100 - current.width, layoutDragStart.left + dx)),
            top: Math.max(0, Math.min(100 - current.height, layoutDragStart.top + dy))
          };
        });
      } else if (isLayoutResizing) {
        setLayoutConfig(prev => {
          const current = prev || { top: 0, left: 0, width: 100, height: 100 };
          return {
            ...current,
            width: Math.max(1, Math.min(100 - current.left, layoutDragStart.width + dx)),
            height: Math.max(1, Math.min(100 - current.top, layoutDragStart.height + dy))
          };
        });
      }
    };

    const handleMouseUp = () => {
      setIsLayoutDragging(false);
      setIsLayoutResizing(false);
    };

    if (isLayoutDragging || isLayoutResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isLayoutDragging, isLayoutResizing, layoutDragStart]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || !frameId) return;
      const step = e.shiftKey ? 5 : 1;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        setLayoutConfig(prev => {
          const current = prev || { top: 0, left: 0, width: 100, height: 100 };
          if (e.key === 'ArrowUp') return { ...current, top: Math.max(0, current.top - step) };
          if (e.key === 'ArrowDown') return { ...current, top: Math.min(100 - current.height, current.top + step) };
          if (e.key === 'ArrowLeft') return { ...current, left: Math.max(0, current.left - step) };
          if (e.key === 'ArrowRight') return { ...current, left: Math.min(100 - current.width, current.left + step) };
          return current;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [frameId]);

  const activeItem = activeId ? queue.find(q => q.queueKey === activeId) ?? null : null;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const [screensRes, assetsRes, schedulesRes] = await Promise.all([
        api.get('/screens'),
        api.get('/assets'),
        api.get('/schedules'),
      ]);
      setScreens(screensRes.data);
      setAssets(assetsRes.data);
      setSchedules(schedulesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSelectedScreenIds([]);
    setStartTime('00:00');
    setEndTime('23:59');
    setStartDate('');
    setEndDate('');
    setPriority(1);
    setDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
    setTransition('FADE');
    setFrameId('');
    setLayoutConfig(null);
    setMarqueeEnabled(false);
    setMarqueeItems([]);
    setMarqueeTransition('FADE');
    setQueue([]);
    setIsActive(true);
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingId(schedule.id);
    setName(schedule.name);
    setSelectedScreenIds([schedule.screenId]);
    setStartTime(schedule.startTime);
    setEndTime(schedule.endTime);
    setStartDate(schedule.startDate ? schedule.startDate.split('T')[0] : '');
    setEndDate(schedule.endDate ? schedule.endDate.split('T')[0] : '');
    setPriority(schedule.priority ?? 1);
    setDaysOfWeek((schedule as any).daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]);
    setTransition((schedule as any).transition ?? 'FADE');
    setFrameId(schedule.frameId ?? '');
    setLayoutConfig((schedule as any).layoutConfig ?? null);
    const mc = (schedule as any).marqueeConfig;
    if (mc && mc.enabled) {
      setMarqueeEnabled(true);
      setMarqueeItems(mc.items || []);
      setMarqueeTransition(mc.transitionEffect || 'FADE');
    } else {
      setMarqueeEnabled(false);
      setMarqueeItems([]);
      setMarqueeTransition('FADE');
    }
    setQueue(schedule.items.map(item => ({
      queueKey: uid(),
      asset: item.asset,
      durationForSchedule: (item as any).duration || item.asset.duration || 120,
    })));
    setIsActive(schedule.isActive);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此播放排程嗎？')) return;
    try {
      await api.delete(`/schedules/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('刪除失敗');
    }
  };

  const toggleStatus = async (schedule: Schedule) => {
    try {
      await api.post(`/schedules/${schedule.id}`, { isActive: !schedule.isActive });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedScreenIds.length === 0 || queue.length === 0) {
      alert('請選擇螢幕與至少一個素材');
      return;
    }
    const assetItems = queue.map(q => ({
      id: q.asset.id,
      duration: q.durationForSchedule !== q.asset.duration ? q.durationForSchedule : undefined,
    }));
    const payload = {
      name: name || `排程 ${new Date().toLocaleDateString()}`,
      startTime,
      endTime,
      daysOfWeek,
      assetItems,
      priority,
      transition,
      frameId: frameId || null,
      layoutConfig: frameId ? layoutConfig : null,
      marqueeConfig: marqueeEnabled && marqueeItems.length > 0 ? {
        enabled: true,
        items: marqueeItems,
        transitionEffect: marqueeTransition,
      } : null,
      isActive,
      startDate: startDate || null,
      endDate: endDate || null,
    };
    try {
      if (editingId) {
        await api.post(`/schedules/${editingId}`, { ...payload, screenId: selectedScreenIds[0] });
        alert('排程已更新');
      } else if (selectedScreenIds.length === 1) {
        await api.post('/schedules', { ...payload, screenId: selectedScreenIds[0] });
        alert('排程已建立');
      } else {
        const res = await api.post('/schedules/batch', { ...payload, screenIds: selectedScreenIds });
        alert(`已為 ${res.data.created} 個螢幕建立排程`);
      }
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      alert('操作失敗');
    }
  };

  // Add asset to queue (can be added multiple times)
  const addAssetToQueue = (asset: Asset) => {
    setQueue(prev => [...prev, { queueKey: uid(), asset, durationForSchedule: asset.duration || undefined }]);
  };

  const handleRemoveFromQueue = (queueKey: string) => {
    setQueue(prev => prev.filter(q => q.queueKey !== queueKey));
  };

  const handleDurationChange = (queueKey: string, newDuration: number) => {
    setQueue(prev => prev.map(q =>
      q.queueKey === queueKey ? { ...q, durationForSchedule: newDuration } : q
    ));
  };

  const handleLayoutChange = (key: keyof LayoutConfig, value: number) => {
    setLayoutConfig(prev => {
      const base = prev || { top: 0, left: 0, width: 100, height: 100 };
      return { ...base, [key]: value };
    });
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      setQueue(prev => {
        const oldIndex = prev.findIndex(q => q.queueKey === active.id);
        const newIndex = prev.findIndex(q => q.queueKey === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading)
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity className="animate-spin text-[#1A5336]" size={40} />
          <span className="text-slate-400 font-bold font-sans uppercase tracking-widest text-xs">
            載入數據中
          </span>
        </div>
      </div>
    );

  const queueKeys = queue.map(q => q.queueKey);
  // Count how many times each asset appears in queue
  const assetQueueCount = queue.reduce<Record<string, number>>((acc, q) => {
    acc[q.asset.id] = (acc[q.asset.id] || 0) + 1;
    return acc;
  }, {});

  // Filter assets based on first selected screen orientation
  const selectedScreenData = screens.find(s => s.id === selectedScreenIds[0]);
  const filteredAssets = assets.filter(asset => {
    if (!selectedScreenData) return true;
    if (selectedScreenData.orientation.startsWith('LANDSCAPE')) return asset.orientation.startsWith('LANDSCAPE');
    if (selectedScreenData.orientation.startsWith('PORTRAIT')) return asset.orientation.startsWith('PORTRAIT');
    return asset.orientation === selectedScreenData.orientation;
  });

  return (
    <div className="space-y-12 pb-20 mt-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
            播放排程管理
          </h1>
          <p className="text-slate-500 font-medium">規劃看板的內容播放時段與規則</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
        {/* ── Left: Form ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200/60 rounded-[32px] p-8 shadow-xl shadow-slate-200/40 relative overflow-hidden">
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${editingId ? 'bg-amber-400' : 'bg-[#1A5336]'}`}
            />
            <div className="flex items-center gap-3 mb-8">
              <div
                className={`p-3 rounded-2xl ${editingId ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-[#1A5336]'}`}
              >
                {editingId ? <Edit2 size={24} /> : <Calendar size={24} />}
              </div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                {editingId ? '編輯現有排程' : '建立新排程'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    排程名稱
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="例如: 午餐促銷、活動通知"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none"
                  />
                </div>

                {/* Screen - Multi-select Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2 ml-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      選擇螢幕 {selectedScreenIds.length > 0 && <span className="text-[#1A5336]">({selectedScreenIds.length} 已選)</span>}
                    </label>
                    {!editingId && (
                      <button
                        type="button"
                        onClick={() => setSelectedScreenIds(selectedScreenIds.length === screens.length ? [] : screens.map(s => s.id))}
                        className="text-[9px] font-black text-[#1A5336] hover:underline uppercase tracking-wider"
                      >
                        {selectedScreenIds.length === screens.length ? '取消全選' : '全選'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    {screens.map(s => (
                      <label key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${selectedScreenIds.includes(s.id) ? 'bg-[#1A5336]/8 border border-[#1A5336]/20' : 'bg-white border border-slate-100 hover:border-slate-200'
                        }`}>
                        <input
                          type={editingId ? 'radio' : 'checkbox'}
                          checked={selectedScreenIds.includes(s.id)}
                          onChange={() => {
                            if (editingId) {
                              setSelectedScreenIds([s.id]);
                            } else {
                              setSelectedScreenIds(prev =>
                                prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                              );
                            }
                          }}
                          className="accent-[#1A5336] w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{s.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium">{s.orientation}</p>
                        </div>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${(s as any).status === 'ONLINE' ? 'bg-green-400' : 'bg-slate-300'}`} />
                      </label>
                    ))}
                    {screens.length === 0 && <p className="text-xs text-slate-400 text-center py-2">尚無螢幕</p>}
                  </div>
                </div>

                {/* Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center">
                      <Clock size={12} className="mr-1.5" /> 開始時間
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center">
                      <Clock size={12} className="mr-1.5" /> 結束時間
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none"
                    />
                  </div>
                </div>

                {/* Days of Week */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
                    適用星期
                  </label>
                  <div className="flex gap-2">
                    {['日', '一', '二', '三', '四', '五', '六'].map((label, idx) => {
                      const selected = daysOfWeek.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setDaysOfWeek(prev =>
                              prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort()
                            );
                          }}
                          className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all ${selected
                            ? 'bg-[#1A5336] text-white shadow-sm'
                            : 'bg-slate-50 text-slate-400 border border-slate-200 hover:border-slate-300'
                            }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center">
                      <Calendar size={12} className="mr-1.5" /> 生效日期
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center">
                      <Calendar size={12} className="mr-1.5" /> 截止日期
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none text-sm"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium -mt-2 ml-1">留空代表「永久有效」不限日期</p>

                {/* Priority */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    優先權數值（排程衝突時，數字越大越優先）
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={priority}
                    onChange={e => setPriority(parseInt(e.target.value) || 1)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none"
                  />
                </div>

                {/* Transition Picker */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    過場效果
                  </label>
                  <select
                    value={transition}
                    onChange={e => setTransition(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none"
                  >
                    <option value="FADE">淡入淡出 (預設)</option>
                    <option value="NONE">無過場</option>
                    <option value="SLIDE_LEFT">向左滑動</option>
                    <option value="BLUR_FADE">模糊漸變</option>
                    <option value="ZOOM_FADE">縮放淡入</option>
                  </select>
                </div>

                {/* Frame Picker */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    外框設定 (Frame)
                  </label>
                  <select
                    value={frameId}
                    onChange={e => setFrameId(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-50 focus:border-[#1A5336] transition-all font-bold outline-none"
                  >
                    <option value="">無外框 (預設)</option>
                    {assets.filter(a => a.type === 'IMAGE').map(asset => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Layout Config (Only show if frameId is selected) */}
                {frameId && (
                  <div className="border border-slate-200 bg-white rounded-3xl p-6 mt-4 space-y-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest">
                          內容播放區域 (裁切與對位)
                        </label>
                        <p className="text-[9px] text-slate-400 font-bold">可直接拖拽預覽框內的藍色區域</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLayoutConfig({ top: 0, left: 0, width: 100, height: 100 })}
                        className="text-[9px] font-black text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg shadow-sm"
                      >
                        重置滿版
                      </button>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Preview Box - Full width in the form */}
                      <div className="flex justify-center items-center">
                        <div 
                          id="layout-preview-container"
                          className="w-full aspect-video bg-slate-900 rounded-[20px] relative overflow-hidden border border-slate-200 shadow-inner group"
                        >
                          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                          
                          <img 
                            src={assets.find(a => a.id === frameId)?.url} 
                            className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none opacity-90"
                            alt="Frame Preview"
                          />
                          
                          <div 
                            onMouseDown={(e) => handleLayoutMouseDown(e, 'move')}
                            className={`absolute bg-blue-500/40 border-2 border-blue-400 flex items-center justify-center backdrop-blur-[1px] transition-all duration-75 shadow-xl cursor-move z-0 group/box ${isLayoutDragging ? 'scale-[1.01] ring-4 ring-blue-400/20' : ''}`}
                            style={{
                              top: `${layoutConfig?.top ?? 0}%`,
                              left: `${layoutConfig?.left ?? 0}%`,
                              width: `${layoutConfig?.width ?? 100}%`,
                              height: `${layoutConfig?.height ?? 100}%`
                            }}
                          >
                            <span className="text-[10px] font-black text-white bg-blue-600/80 px-2 py-0.5 rounded shadow pointer-events-none">播放區域</span>
                            
                            {/* Resize Handle */}
                            <div 
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleLayoutMouseDown(e, 'resize');
                              }}
                              className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 cursor-nwse-resize flex items-center justify-center rounded-tl-lg hover:bg-blue-600 transition-colors group-hover/box:opacity-100 opacity-0"
                            >
                              <Maximize2 size={12} className="text-white" />
                            </div>

                            {/* Info Tooltip */}
                            {(isLayoutDragging || isLayoutResizing) && (
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] px-2 py-1 rounded font-mono whitespace-nowrap z-50">
                                {layoutConfig?.left.toFixed(0)}%, {layoutConfig?.top.toFixed(0)}% | {layoutConfig?.width.toFixed(0)}%x{layoutConfig?.height.toFixed(0)}%
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sliders in a compact grid */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2 border-t border-slate-100">
                        {[
                          { key: 'top', label: '上邊界 (T)', color: 'text-rose-500', accent: 'accent-rose-500' },
                          { key: 'left', label: '左邊界 (L)', color: 'text-indigo-500', accent: 'accent-indigo-500' },
                          { key: 'width', label: '寬度 (W)', color: 'text-emerald-500', accent: 'accent-emerald-500' },
                          { key: 'height', label: '高度 (H)', color: 'text-amber-500', accent: 'accent-amber-500' },
                        ].map(slider => (
                          <div key={slider.key} className="space-y-1">
                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                              <span className={slider.color}>{slider.label}</span>
                              <span className="text-slate-400">{(layoutConfig as any)?.[slider.key] ?? (slider.key.includes('width') || slider.key.includes('height') ? 100 : 0)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={(layoutConfig as any)?.[slider.key] ?? (slider.key.includes('width') || slider.key.includes('height') ? 100 : 0)}
                              onChange={e => handleLayoutChange(slider.key as keyof LayoutConfig, parseInt(e.target.value))}
                              className={`w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer ${slider.accent}`}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold italic text-center">
                        * 提示：選中設定框後可使用方向鍵微調位置
                      </p>
                    </div>
                  </div>
                )}

                {/* ─── Marquee Config ─── */}
                <div className="border border-slate-200 bg-slate-50/50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      📢 底部跑馬燈
                    </label>
                    <button
                      type="button"
                      onClick={() => setMarqueeEnabled(!marqueeEnabled)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-tighter transition-all ${marqueeEnabled ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                    >
                      {marqueeEnabled ? '已啟用' : '未啟用'}
                    </button>
                  </div>

                  {marqueeEnabled && (
                    <div className="space-y-3">
                      {/* Available Marquee Assets */}
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">加入跑馬燈素材</label>
                        <div className="flex flex-wrap gap-2">
                          {assets.filter(a => a.type === 'MARQUEE').map(asset => {
                            const isSelected = marqueeItems.some(m => m.assetId === asset.id);
                            return (
                              <button
                                key={asset.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setMarqueeItems(prev => prev.filter(m => m.assetId !== asset.id));
                                  } else {
                                    setMarqueeItems(prev => [...prev, { assetId: asset.id, duration: 60 }]);
                                  }
                                }}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${isSelected ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'}`}
                              >
                                📢 {asset.name}
                              </button>
                            );
                          })}
                          {assets.filter(a => a.type === 'MARQUEE').length === 0 && (
                            <p className="text-xs text-slate-400 italic">尚未建立跑馬燈素材，請先到素材庫建立</p>
                          )}
                        </div>
                      </div>

                      {/* Selected marquee items with duration */}
                      {marqueeItems.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">輪播順序與停留秒數</label>
                          {marqueeItems.map((item, idx) => {
                            const asset = assets.find(a => a.id === item.assetId);
                            return (
                              <div key={item.assetId} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-slate-200">
                                <span className="text-[10px] font-black text-amber-600 w-5">{idx + 1}.</span>
                                <span className="text-xs font-bold text-slate-700 flex-1 truncate">{asset?.name || item.assetId}</span>
                                <input
                                  type="number"
                                  min={10}
                                  max={300}
                                  value={item.duration}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 60;
                                    setMarqueeItems(prev => prev.map((m, i) => i === idx ? { ...m, duration: val } : m));
                                  }}
                                  className="w-16 px-2 py-1 text-xs font-bold border border-slate-200 rounded-lg text-center"
                                />
                                <span className="text-[9px] text-slate-400 font-bold">秒</span>
                                <button
                                  type="button"
                                  onClick={() => setMarqueeItems(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-red-400 hover:text-red-600 text-xs font-bold"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Transition Effect */}
                      {marqueeItems.length > 1 && (
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">輪播過場效果</label>
                          <select
                            value={marqueeTransition}
                            onChange={e => setMarqueeTransition(e.target.value)}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                          >
                            <option value="FADE">淡入淡出</option>
                            <option value="SLIDE_UP">向上滑入</option>
                            <option value="NONE">直接切換</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between pt-2 px-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    目前狀態
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-tighter transition-all ${isActive ? 'bg-[#1A5336] text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {isActive ? '啟用中' : '已停用'}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                  >
                    取消
                  </button>
                )}
                <button
                  type="submit"
                  className={`flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-lg transition-all active:scale-95 ${editingId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-[#1A5336] hover:bg-[#1A5336]/90 shadow-green-200'}`}
                >
                  {editingId ? '更新排程設定' : '立即建立排程'}
                </button>
              </div>
            </form>
          </div>

          {/* Tip card */}
          <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -translate-x-[-20%] -translate-y-12" />
            <h3 className="font-black uppercase tracking-widest text-xs mb-4 text-green-400">
              小撇步
            </h3>
            <p className="text-sm font-medium leading-relaxed text-slate-300">
              點擊素材加入播放佇列，同一素材可{' '}
              <span className="text-white font-black">重複加入多次</span>{' '}
              實現穿插播放效果。用{' '}
              <span className="text-white font-black">⠿ 拖拉把手</span>{' '}
              調整播放順序，儲存後系統依照清單順序循環播放。
            </p>
          </div>
        </div>

        {/* ── Right: Asset picker + Queue + Schedule list ─────────────────── */}
        <div className="xl:col-span-8 space-y-12">
          {/* ── Asset Library + Queue (side by side on md+) ──────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Asset Library */}
            <div className="space-y-4">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <ImageIcon size={16} className="text-blue-500" />
                素材庫
              </h2>
              <div className="grid grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1 rounded-xl">
                {filteredAssets.map(asset => {
                  const count = assetQueueCount[asset.id] || 0;
                  const inQueue = count > 0;
                  const thumb =
                    asset.thumbnailUrl || (asset.type === 'IMAGE' ? asset.url : null);
                  return (
                    <button
                      key={asset.id}
                      onClick={() => addAssetToQueue(asset)}
                      className={`group relative bg-white border rounded-[18px] overflow-hidden transition-all text-left ${inQueue
                        ? 'ring-4 ring-blue-500/30 border-blue-500'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                        }`}
                    >
                      <div className="aspect-video relative bg-slate-100">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white opacity-40">
                            <Film size={18} />
                          </div>
                        )}
                        {/* Orientation Badge */}
                        <div className="absolute bottom-1 left-1 flex items-center bg-black/60 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md backdrop-blur-sm z-10 pointer-events-none gap-1">
                          <span>{asset.type === 'VIDEO' ? 'VIDEO' : 'IMAGE'}</span>
                          <span className="opacity-50">|</span>
                          <span>{asset.orientation === 'PORTRAIT' ? '9:16' : (asset.orientation === 'PORTRAIT_34' ? '3:4' : (asset.orientation === 'LANDSCAPE_43' ? '4:3' : '16:9'))}</span>
                        </div>
                        {inQueue && (
                          <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white rounded-full min-w-[22px] h-[22px] flex items-center justify-center shadow-lg z-10 pointer-events-none px-1">
                            <span className="text-[10px] font-black leading-none">{count}</span>
                          </div>
                        )}
                        {/* hover overlay: always + (add again) */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                          <span className="text-white text-xl font-black">+</span>
                        </div>
                      </div>
                      <div className="p-2">
                        <p className="text-[9px] font-bold text-slate-600 truncate">
                          {asset.name}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Play Queue */}
            <div className="space-y-4">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <ListOrdered size={16} className="text-[#1A5336]" />
                播放佇列
                {queue.length > 0 && (
                  <span className="ml-auto text-[#1A5336] text-sm font-black">
                    {queue.length} 個
                  </span>
                )}
              </h2>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={queueKeys} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 min-h-[120px]">
                    {queue.length === 0 ? (
                      <div className="min-h-[200px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-300 gap-2">
                        <ListOrdered size={28} />
                        <p className="text-xs font-bold">點擊左側素材加入佇列</p>
                      </div>
                    ) : (
                      queue.map((qItem, index) => (
                        <SortableQueueItem
                          key={qItem.queueKey}
                          item={qItem}
                          index={index}
                          onRemove={handleRemoveFromQueue}
                          onDurationChange={handleDurationChange}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>

                <DragOverlay
                  dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                      styles: { active: { opacity: '0.4' } },
                    }),
                  }}
                >
                  <DragGhostCard asset={activeItem?.asset ?? null} />
                </DragOverlay>
              </DndContext>
            </div>
          </div>

          <hr className="border-slate-200/60" />

          {/* Existing Schedules */}
          <div className="space-y-6">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
              <div className="w-2 h-8 bg-[#1A5336] rounded-full" />
              現有播放排程清單
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {schedules.map(schedule => (
                <div
                  key={schedule.id}
                  className="group bg-white border border-slate-200 rounded-[32px] p-6 hover:shadow-2xl hover:shadow-slate-200/50 transition-all relative"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-slate-800 truncate">{schedule.name}</h4>
                        {!schedule.isActive && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[8px] font-black uppercase tracking-widest rounded-md">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                        <Monitor size={10} /> {schedule.screen.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/analytics/schedules/${schedule.id}`)}
                        className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-500 rounded-xl transition-all"
                        title="成效報表"
                      >
                        <BarChart3 size={18} />
                      </button>
                      <button
                        onClick={() => handleEdit(schedule)}
                        className="p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-500 rounded-xl transition-all"
                        title="編輯排程"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
                        title="刪除排程"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-6">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-600">
                      <Clock size={12} className="text-[#1A5336]" />
                      {schedule.startTime} - {schedule.endTime}
                    </div>
                    {/* Priority Badge */}
                    <div className={`flex items-center px-3 py-1.5 rounded-full text-[10px] font-black ${schedule.priority > 1 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-500 border border-slate-100'
                      }`}>
                      P{schedule.priority}
                    </div>
                    {/* Frame Badge */}
                    {schedule.frame && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-full text-[10px] font-black text-purple-600">
                        <ImageIcon size={11} />
                        套用外框: {schedule.frame.name}
                      </div>
                    )}
                    {/* Marquee Badge */}
                    {(schedule as any).marqueeConfig?.enabled && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-full text-[10px] font-black text-amber-700">
                        <Megaphone size={11} />
                        套用跑馬燈: {(schedule as any).marqueeConfig.items?.length || 0} 項內容
                      </div>
                    )}
                    {/* Date Range Badge */}
                    {(schedule.startDate || schedule.endDate) && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-black text-blue-600">
                        <Calendar size={11} />
                        {schedule.startDate ? new Date(schedule.startDate).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }) : '不限'}
                        {' – '}
                        {schedule.endDate ? new Date(schedule.endDate).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }) : '不限'}
                      </div>
                    )}
                    <div className="flex -space-x-3 overflow-hidden">
                      {schedule.items.slice(0, 4).map((item, idx) => {
                        const thumb =
                          item.asset.thumbnailUrl ||
                          (item.asset.type === 'IMAGE' ? item.asset.url : null);
                        return (
                          <div
                            key={idx}
                            className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden shadow-sm"
                          >
                            {thumb ? (
                              <img
                                src={thumb}
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-800 text-[6px] text-white">
                                V
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {schedule.items.length > 4 && (
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                          +{schedule.items.length - 4}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleStatus(schedule)}
                    className={`w-full py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${schedule.isActive ? 'bg-green-50 text-[#1A5336] hover:bg-green-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    {schedule.isActive ? '✅ 排程生效中' : '⚪ 點擊啟用排程'}
                  </button>
                </div>
              ))}

              {schedules.length === 0 && (
                <div className="col-span-full py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] flex flex-col items-center justify-center text-slate-400">
                  <Calendar size={40} className="mb-4 opacity-20" />
                  <p className="font-bold text-sm">目前尚無任何播放排程</p>
                  <p className="text-xs opacity-60">使用左側表單建立第一個規則</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
