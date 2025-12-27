
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Trash2, List as ListIcon, PieChart as PieChartIcon, X, ChevronLeft, ChevronRight, BookOpen, Search, Quote, CalendarDays, ChevronDown } from 'lucide-react';
import { Transaction, Diary } from '../types';
import { CATEGORY_GROUPS, INCOME_CATEGORY, CategoryItem, CHART_COLORS } from '../constants';

interface DetailsProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  diaries: Diary[];
  onSaveDiary: (date: string, content: string) => void;
}

const getLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const Details: React.FC<DetailsProps> = ({ transactions, onDelete, diaries }) => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'day' | 'month' | 'year' | 'all'>('month');
  const [selDay, setSelDay] = useState(getLocalDateString(new Date()));
  const [selMonth, setSelMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selYear, setSelYear] = useState(new Date().getFullYear().toString());
  const [searchTerm, setSearchTerm] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerViewDate, setPickerViewDate] = useState(new Date());

  useEffect(() => {
    const dParam = searchParams.get('date');
    if (dParam) { 
      setSelDay(dParam); 
      setMode('day'); 
      setPickerViewDate(new Date(dParam));
    }
  }, [searchParams]);

  const allCats = useMemo(() => {
    const items: CategoryItem[] = [];
    CATEGORY_GROUPS.forEach(g => items.push(...g.items));
    items.push(INCOME_CATEGORY);
    return items;
  }, []);

  const filteredDiaries = useMemo(() => {
    let res = diaries;
    if (mode === 'day') res = res.filter(d => d.date === selDay);
    else if (mode === 'month') res = res.filter(d => d.date.startsWith(selMonth));
    else if (mode === 'year') res = res.filter(d => d.date.startsWith(selYear));
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      res = res.filter(d => d.content.toLowerCase().includes(q));
    }
    return [...res].sort((a, b) => b.date.localeCompare(a.date));
  }, [diaries, mode, selDay, selMonth, selYear, searchTerm]);

  const filteredTransactions = useMemo(() => {
    let res = transactions;
    if (mode === 'day') res = res.filter(t => t.date === selDay);
    else if (mode === 'month') res = res.filter(t => t.date.startsWith(selMonth));
    else if (mode === 'year') res = res.filter(t => t.date.startsWith(selYear));
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      res = res.filter(t => (t.note || '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    }
    return [...res].sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, mode, selDay, selMonth, selYear, searchTerm]);

  const stats = useMemo(() => {
    const inc = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { inc, exp, bal: inc - exp };
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped).map(([name, value]) => ({ 
      name: allCats.find(i => i.label === name)?.displayLabel || name, 
      value: value as number 
    })).sort((a, b) => (b.value as number) - (a.value as number));
  }, [filteredTransactions, allCats]);

  const calendarDays = useMemo(() => {
    const year = pickerViewDate.getFullYear();
    const month = pickerViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  }, [pickerViewDate]);

  return (
    <div className="space-y-4 pb-20 animate-in slide-in-from-bottom-4 duration-500">
      {showPicker && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-extrabold text-black">{mode === 'day' ? '选择日期' : mode === 'month' ? '选择月份' : '选择年份'}</h3>
              <button onClick={() => setShowPicker(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 tap-scale"><X size={24} /></button>
            </div>
            {mode === 'day' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <button onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() - 1, 1))} className="p-3 bg-slate-50 rounded-2xl tap-scale"><ChevronLeft size={24}/></button>
                  <span className="font-extrabold text-lg">{pickerViewDate.getFullYear()}年 {pickerViewDate.getMonth() + 1}月</span>
                  <button onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() + 1, 1))} className="p-3 bg-slate-50 rounded-2xl tap-scale"><ChevronRight size={24}/></button>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-xs font-bold text-slate-300">{d}</div>)}
                  {calendarDays.map((day, idx) => (
                    day ? (
                      <button key={idx} onClick={() => { setSelDay(getLocalDateString(day)); setShowPicker(false); }} className={`h-11 flex items-center justify-center rounded-2xl text-sm font-bold transition-all tap-scale ${getLocalDateString(day) === selDay ? 'bg-black text-white shadow-xl' : 'text-slate-700'}`}>
                        {day.getDate()}
                      </button>
                    ) : <div key={idx} className="h-11" />
                  ))}
                </div>
              </div>
            )}
            {mode === 'month' && (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({length: 12}).map((_, i) => {
                  const mStr = `${pickerViewDate.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
                  return (
                    <button key={i} onClick={() => { setSelMonth(mStr); setShowPicker(false); }} className={`py-5 rounded-3xl text-sm font-extrabold transition-all tap-scale ${selMonth === mStr ? 'bg-black text-white shadow-xl' : 'bg-slate-50 text-slate-600'}`}>
                      {i + 1}月
                    </button>
                  );
                })}
              </div>
            )}
            {mode === 'year' && (
              <div className="grid grid-cols-3 gap-3 max-h-[25rem] overflow-y-auto pr-1 hide-scrollbar overscroll-contain">
                {Array.from({length: 201}).map((_, i) => {
                  const baseYear = new Date().getFullYear();
                  const y = (baseYear + 100 - i).toString();
                  return (
                    <button 
                      key={y} 
                      onClick={() => { setSelYear(y); setShowPicker(false); }} 
                      className={`py-4 rounded-3xl text-sm font-extrabold transition-all tap-scale ${selYear === y ? 'bg-black text-white shadow-xl scale-105 z-10' : 'bg-slate-50 text-slate-500'}`}
                    >
                      {y}
                      <span className="text-[10px] ml-0.5 opacity-50 font-bold">年</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 固定筛选栏 */}
      <div className="sticky top-[-1px] z-20 space-y-4 pt-1 pb-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-[2.2rem] p-5 shadow-sm border border-white/50 space-y-4">
          <div className="flex bg-slate-100/80 p-1 rounded-2xl">
            {(['day', 'month', 'year', 'all'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2.5 rounded-xl text-[11px] font-extrabold transition-all tap-scale ${mode === m ? 'bg-white shadow-md text-black' : 'text-slate-400'}`}>
                {m === 'day' ? '按日' : m === 'month' ? '按月' : m === 'year' ? '按年' : '全部'}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2">
             <div className="relative flex-1 group">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-black transition-colors" />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="搜索明细或随笔..." className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all" />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-slate-200 rounded-full text-slate-500"><X size={14} /></button>}
             </div>
             {mode !== 'all' && (
               <button onClick={() => setShowPicker(true)} className="flex items-center gap-2 px-4 py-3.5 bg-black text-white rounded-2xl text-[11px] font-extrabold tap-scale shadow-lg shadow-black/10">
                 <CalendarDays size={18} />
                 <span>{mode === 'day' ? selDay.slice(5) : mode === 'month' ? selMonth : selYear}</span>
                 <ChevronDown size={14} className="opacity-50" />
               </button>
             )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-1">
          <div className="bg-white/70 backdrop-blur-sm p-3.5 rounded-2xl shadow-sm border border-white/50">
            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">本期收入</p>
            <p className="text-[14px] font-extrabold text-green-600 truncate">¥{stats.inc.toLocaleString()}</p>
          </div>
          <div className="bg-white/70 backdrop-blur-sm p-3.5 rounded-2xl shadow-sm border border-white/50">
            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">本期支出</p>
            <p className="text-[14px] font-extrabold text-red-500 truncate">¥{stats.exp.toLocaleString()}</p>
          </div>
          <div className="bg-white/70 backdrop-blur-sm p-3.5 rounded-2xl shadow-sm border border-white/50">
            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">周期结余</p>
            <p className="text-[14px] font-extrabold text-black truncate">¥{stats.bal.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 随笔列表 */}
      {filteredDiaries.length > 0 && (
        <div className="space-y-4 px-1">
          <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] ml-4 flex items-center gap-2">
             随笔记录 ({filteredDiaries.length})
          </h3>
          <div className="space-y-3">
            {filteredDiaries.map((diary) => (
              <div key={diary.date} className="bg-white rounded-[2rem] p-6 relative overflow-hidden shadow-sm border border-slate-50 active:scale-[0.98] transition-all">
                <Quote size={40} className="absolute -right-2 -bottom-2 text-slate-50 opacity-40" />
                <div className="flex justify-between items-center mb-3">
                  <div className="bg-slate-50 p-2 rounded-xl"><BookOpen size={16} className="text-slate-400" /></div>
                  <span className="text-[10px] font-extrabold text-slate-300">{diary.date}</span>
                </div>
                <p className="text-[14px] font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">“{diary.content}”</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 账单列表 */}
      <div className="space-y-4 px-1">
        <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] ml-4 mt-6 flex items-center gap-2">
           账单明细 ({filteredTransactions.length})
        </h3>
        <div className="space-y-3">
          {filteredTransactions.length > 0 ? filteredTransactions.map(t => {
            const cat = allCats.find(i => i.label === t.category);
            return (
              <div key={t.id} className="bg-white p-4 rounded-[1.8rem] shadow-sm flex items-center gap-4 border border-slate-50 tap-scale">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: cat?.color || '#94a3b8' }}>
                  {cat?.icon ? React.cloneElement(cat.icon as React.ReactElement<any>, { size: 24, color: 'white' }) : <ListIcon size={24} color="white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-extrabold text-black text-[15px] truncate">{cat?.displayLabel || t.category}</h4>
                    <p className={`font-extrabold text-[15px] ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                      {t.type === 'income' ? '+' : '-'}¥{t.amount.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                    </p>
                  </div>
                  <div className="flex justify-between items-center">
                     <p className="text-[11px] font-bold text-slate-400 truncate pr-4">{t.note || '无备注'}</p>
                     <span className="text-[9px] font-extrabold text-slate-200">{t.date.slice(5)}</span>
                  </div>
                </div>
                <button onClick={() => onDelete(t.id)} className="p-3 text-slate-200 hover:text-red-400 tap-scale"><Trash2 size={20} /></button>
              </div>
            );
          }) : <div className="py-20 text-center text-slate-200 font-extrabold text-xs tracking-widest opacity-40">暂无相关记录</div>}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-50 mt-8 mx-1">
          <h3 className="text-sm font-extrabold text-black flex items-center gap-2 mb-6">支出结构分布</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                  {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={0} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Details;
