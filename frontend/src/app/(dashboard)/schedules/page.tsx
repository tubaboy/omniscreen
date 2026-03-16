'use client';

import { useState, useEffect } from 'react';
import api, { Screen, Asset } from '@/lib/api';
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
  screen: Screen;
  items: { asset: Asset }[];
}

// ── SortableQueueItem ──────────────────────────────────────────────────────────
function SortableQueueItem({
  asset,
  index,
  onRemove,
  onDurationChange,
}: {
  asset: Asset & { durationForSchedule?: number };
  index: number;
  onRemove: (id: string) => void;
  onDurationChange: (id: string, duration: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: asset.id });

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
          <span>{asset.orientation === 'PORTRAIT' ? '9:16' : '16:9'}</span>
        </div>
      </div>

      {/* Name */}
      <p className="flex-1 text-xs font-bold text-slate-700 truncate">{asset.name}</p>

      {/* Duration Input for Images, Widgets and Web Assets */}
      {(asset.type === 'IMAGE' || asset.type === 'WIDGET' || asset.type === 'WEB') && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Clock size={12} className="text-slate-400" />
          <input
            type="number"
            min="1"
            className="w-14 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-center"
            value={asset.durationForSchedule || asset.duration || 30}
            onChange={(e) => onDurationChange(asset.id, parseInt(e.target.value) || 10)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()} // 防止被 dnd-kit 攔截
            title="播放秒數"
          />
          <span className="text-[10px] font-bold text-slate-400">秒</span>
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={() => onRemove(asset.id)}
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
          <span>{asset.orientation === 'PORTRAIT' ? '9:16' : '16:9'}</span>
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
  // Queue: ordered array of asset objects with optional duration override
  const [queue, setQueue] = useState<(Asset & { durationForSchedule?: number })[]>([]);
  const [isActive, setIsActive] = useState(true);

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeAsset = activeId ? queue.find(a => a.id === activeId) ?? null : null;

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
    setQueue(schedule.items.map(item => ({
      ...item.asset,
      durationForSchedule: (item as any).duration || item.asset.duration || 30, // Default to 30 for widgets/web if unknown
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
    const assetItems = queue.map(a => ({
      id: a.id,
      // Only send duration if it was explicitly changed to something different from the asset's default.
      // This allows the backend to fallback to the asset's current duration if it's null in the PlaylistItem.
      duration: a.durationForSchedule !== a.duration ? a.durationForSchedule : undefined,
    }));
    const payload = {
      name: name || `排程 ${new Date().toLocaleDateString()}`,
      startTime,
      endTime,
      daysOfWeek,
      assetItems,
      priority,
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

  // Toggle asset in/out of queue
  const toggleAsset = (asset: Asset) => {
    setQueue(prev => {
      const exists = prev.find(a => a.id === asset.id);
      if (exists) return prev.filter(a => a.id !== asset.id);
      return [...prev, asset];
    });
  };

  const handleRemoveFromQueue = (assetId: string) => {
    setQueue(prev => prev.filter(a => a.id !== assetId));
  };

  const handleDurationChange = (assetId: string, newDuration: number) => {
    setQueue(prev => prev.map(a =>
      a.id === assetId ? { ...a, durationForSchedule: newDuration } : a
    ));
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
        const oldIndex = prev.findIndex(a => a.id === active.id);
        const newIndex = prev.findIndex(a => a.id === over.id);
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

  const queueIds = queue.map(a => a.id);

  // Filter assets based on first selected screen orientation
  const selectedScreenData = screens.find(s => s.id === selectedScreenIds[0]);
  const filteredAssets = assets.filter(asset => {
    if (!selectedScreenData) return true;
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
              點擊素材加入播放佇列，並用{' '}
              <span className="text-white font-black">⠿ 拖拉把手</span>{' '}
              調整播放順序。儲存後系統依照清單順序循環播放。
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
                  const inQueue = queueIds.includes(asset.id);
                  const thumb =
                    asset.thumbnailUrl || (asset.type === 'IMAGE' ? asset.url : null);
                  return (
                    <button
                      key={asset.id}
                      onClick={() => toggleAsset(asset)}
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
                          <span>{asset.orientation === 'PORTRAIT' ? '9:16' : '16:9'}</span>
                        </div>
                        {inQueue && (
                          <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white rounded-full p-0.5 shadow-lg z-10 pointer-events-none">
                            <CheckCircle2 size={13} />
                          </div>
                        )}
                        {/* hover overlay: show + or – */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                          <span className="text-white text-xl font-black">
                            {inQueue ? '−' : '+'}
                          </span>
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
                <SortableContext items={queueIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 min-h-[120px]">
                    {queue.length === 0 ? (
                      <div className="min-h-[200px] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-300 gap-2">
                        <ListOrdered size={28} />
                        <p className="text-xs font-bold">點擊左側素材加入佇列</p>
                      </div>
                    ) : (
                      queue.map((asset, index) => (
                        <SortableQueueItem
                          key={asset.id}
                          asset={asset}
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
                  <DragGhostCard asset={activeAsset} />
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
