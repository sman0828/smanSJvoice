
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Download, Upload, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, BookOpen, Save, Wallet, Mic, MicOff, RotateCcw, Trash2 } from 'lucide-react';
import { Transaction, Diary, TransactionType } from '../types';
import { CATEGORY_GROUPS, INCOME_CATEGORY } from '../constants';

interface HomeProps {
  transactions: Transaction[];
  diaries: Diary[];
  onAdd: (t: Transaction) => void;
  onImportAll: (ts: Transaction[], ds: Diary[]) => void;
  onSaveDiary: (date: string, content: string) => void;
}

const getLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * 工业级中文数字转阿拉伯数字工具
 * 支持：十, 十二, 二十, 一百, 一百零三, 一万二, 两块五, 十块三毛二等
 */
const chineseToNumber = (chnStr: string): number | null => {
  if (!chnStr) return null;
  
  const chnNumChar: Record<string, number> = {
    '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9
  };
  const chnUnitChar: Record<string, number> = {
    '十': 10, '百': 100, '千': 1000, '万': 10000
  };

  // 1. 处理货币口语单位转换（块/元 -> 整数部分，毛/角/分 -> 小数部分）
  if (chnStr.includes('块') || chnStr.includes('元')) {
    const parts = chnStr.split(/[块元]/);
    const integerPart = chineseToNumber(parts[0]) || 0;
    if (parts[1]) {
      let decimalPartStr = parts[1].replace(/[毛角分]/g, '');
      // 处理“两块五”这种后面跟单数字的情况
      if (decimalPartStr.length === 1) {
        return integerPart + (chnNumChar[decimalPartStr] || 0) / 10;
      }
      // 处理“两块五毛三”
      const decMatch = parts[1].match(/([零一二两三四五六七八九]+)[毛角]([零一二两三四五六七八九]+)?分?/);
      if (decMatch) {
        const jiao = chnNumChar[decMatch[1]] || 0;
        const fen = decMatch[2] ? (chnNumChar[decMatch[2]] || 0) : 0;
        return integerPart + jiao / 10 + fen / 100;
      }
      // 兜底尝试解析
      const decVal = chineseToNumber(decimalPartStr);
      return integerPart + (decVal ? decVal / (decVal < 10 ? 10 : 100) : 0);
    }
    return integerPart;
  }

  // 2. 递归/循环处理标准大数结构
  let total = 0;
  let section = 0;
  let number = 0;
  let hasNum = false;

  for (let i = 0; i < chnStr.length; i++) {
    const char = chnStr[i];
    const num = chnNumChar[char];
    if (typeof num !== 'undefined') {
      number = num;
      hasNum = true;
      if (i === chnStr.length - 1) {
        section += number;
      }
    } else {
      const unit = chnUnitChar[char];
      if (typeof unit !== 'undefined') {
        if (char === '十' && !hasNum) {
          number = 1; // 处理“十二”
        }
        section += (number * unit);
        number = 0;
        hasNum = false;
      }
    }
  }
  return section > 0 || hasNum ? section : null;
};

const Home: React.FC<HomeProps> = ({ transactions, diaries, onAdd, onImportAll, onSaveDiary }) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState('餐饮');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalDateString(new Date()));
  const [note, setNote] = useState('');
  const [diaryInput, setDiaryInput] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState<'diary' | 'transaction' | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const isActuallyRecording = useRef(false);
  const recordingTargetRef = useRef<'diary' | 'transaction' | null>(null);

  const parseVoiceCommand = useCallback((text: string) => {
    // 1. 深度日期识别
    const today = new Date();
    let targetDate = date;
    if (text.includes('前天')) {
      const d = new Date(today);
      d.setDate(today.getDate() - 2);
      targetDate = getLocalDateString(d);
    } else if (text.includes('昨天')) {
      const d = new Date(today);
      d.setDate(today.getDate() - 1);
      targetDate = getLocalDateString(d);
    } else if (text.includes('今天')) {
      targetDate = getLocalDateString(today);
    }
    setDate(targetDate);

    // 2. 类型识别（增强词库）
    let newType: TransactionType = 'expense';
    if (text.match(/收入|工资|领到|进账|赚了|收到|发奖金|分红|抢到红包|兼职/)) {
      newType = 'income';
      setType('income');
      setCategory('收入');
    } else {
      setType('expense');
    }

    // 3. 复合金额识别
    let extractedAmount: string | null = null;
    const arabicMatch = text.match(/\d+(\.\d+)?/);
    if (arabicMatch) {
      extractedAmount = arabicMatch[0];
    } else {
      // 匹配中文字符序列：尝试寻找包含数字和货币单位的最长连续块
      const chineseNumRegex = /[零一二两三四五六七八九十百千万]+([块元][零一二两三四五六七八九十毛角分]*)?/;
      const chnMatch = text.match(chineseNumRegex);
      if (chnMatch) {
        const num = chineseToNumber(chnMatch[0]);
        if (num !== null) extractedAmount = num.toString();
      }
    }
    
    if (extractedAmount) {
      setAmount(extractedAmount);
    }

    // 4. 精细化分类解析（强化 菜篮子、票务、五金）
    const allCats = CATEGORY_GROUPS.flatMap(g => g.items);
    let matched = false;

    // A. 关键词库映射
    const semanticMap: Record<string, string[]> = {
      '菜篮子': ['买菜', '蔬菜', '生鲜', '菜场', '超市买菜', '猪肉', '鸡蛋', '鱼', '虾', '肉', '土豆'],
      '票务': ['门票', '票', '电影票', '入场券', '入场', '景点', '展会', '话剧', '音乐会'],
      '日用五金': ['五金', '灯泡', '螺丝', '工具', '插板', '维修', '水龙头', '电池'],
      '餐饮': ['吃饭', '奶茶', '咖啡', '火锅', '宵夜', '外卖', '早餐', '午餐', '晚餐', '饮品'],
      '交通': ['打车', '地铁', '公交', '滴滴', '加油', '共享单车', '机票', '火车', '车票'],
      '服饰': ['衣服', '鞋子', '裤子', '裙子', '包包', '首饰', '化妆品', '护肤品'],
      '话': ['话费', '充值', '流量', '网费'],
      '电': ['电费', '充电'],
      '水': ['水费', '买水', '矿泉水']
    };

    if (newType === 'expense') {
      for (const [catName, keywords] of Object.entries(semanticMap)) {
        if (keywords.some(k => text.includes(k))) {
          setCategory(catName);
          matched = true;
          break;
        }
      }
    }

    // B. 如果未命中映射，尝试匹配原始分类名称
    if (!matched) {
      for (const catItem of allCats) {
        if (text.includes(catItem.displayLabel) || text.includes(catItem.label)) {
          setCategory(catItem.label);
          matched = true;
          break;
        }
      }
    }

    // 5. 极致备注清洗
    let cleanNote = text;
    const stopWords = [
      '今天', '昨天', '前天', '花了', '支出', '收入', '块钱', '块', '元', '毛', '角', '分',
      '进账', '领了', '买了', '买了个', '一共', '一共花了', '共计', '赚了', '支出了'
    ];
    stopWords.forEach(word => cleanNote = cleanNote.replace(new RegExp(word, 'g'), ''));
    if (arabicMatch) cleanNote = cleanNote.replace(arabicMatch[0], '');
    const chnMatchForClean = text.match(/[零一二两三四五六七八九十百千万]+([块元][零一二两三四五六七八九十毛角分]*)?/);
    if (chnMatchForClean) cleanNote = cleanNote.replace(chnMatchForClean[0], '');
    
    setNote(cleanNote.trim() || text);
  }, [date]);

  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'zh-CN';

      recognition.onstart = () => {
        isActuallyRecording.current = true;
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const target = recordingTargetRef.current;
        if (target === 'diary') {
          setDiaryInput(prev => prev + (prev ? '，' : '') + transcript);
        } else if (target === 'transaction') {
          parseVoiceCommand(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('语音识别异常:', event.error);
        isActuallyRecording.current = false;
        setIsRecording(false);
        setRecordingTarget(null);
        recordingTargetRef.current = null;
      };

      recognition.onend = () => {
        isActuallyRecording.current = false;
        setIsRecording(false);
        setRecordingTarget(null);
        recordingTargetRef.current = null;
      };

      recognitionRef.current = recognition;
    }
  }, [parseVoiceCommand]);

  useEffect(() => {
    const existing = diaries.find(d => d.date === date);
    setDiaryInput(existing?.content || '');
  }, [date, diaries]);

  const handleStartRecording = (e: React.MouseEvent | React.TouchEvent, target: 'diary' | 'transaction') => {
    e.preventDefault();
    e.stopPropagation();
    if (!recognitionRef.current) {
      alert('您的浏览器不支持语音识别，请在移动端 Chrome 或主流浏览器中尝试。');
      return;
    }
    if (isActuallyRecording.current) return;
    setRecordingTarget(target);
    recordingTargetRef.current = target;
    try {
      recognitionRef.current.start();
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
      console.error('麦克风启动失败:', err);
    }
  };

  const handleStopRecording = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (recognitionRef.current && isActuallyRecording.current) {
      recognitionRef.current.stop();
      if (navigator.vibrate) navigator.vibrate(20);
    }
  };

  const resetTransactionForm = () => {
    setAmount('');
    setNote('');
    if (type === 'expense') setCategory('餐饮');
    else setCategory('收入');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || isNaN(val)) return;
    const group = CATEGORY_GROUPS.find(g => g.items.some(i => i.label === category))?.name || '其他大类';
    onAdd({
      id: Math.random().toString(36).substr(2, 9),
      type, category, categoryGroup: type === 'income' ? '收入' : group,
      amount: Math.abs(val), date, note, createdAt: Date.now()
    });
    resetTransactionForm();
  };

  const handleSaveDiary = () => onSaveDiary(date, diaryInput);

  const handleExport = () => {
    let content = "---思南随记 账单数据---\n日期|类型|分类|金额|备注\n";
    content += transactions.map(t => `${t.date}|${t.type === 'expense' ? '支出' : '收入'}|${t.category}|${t.amount}|${t.note}`).join('\n');
    content += "\n---思南随记 随笔数据---\n日期|内容\n";
    content += diaries.map(d => `${d.date}|${d.content.replace(/\n/g, '\\n')}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `思南随记备份_${date}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      let currentSection = "";
      const importedTs: Transaction[] = [];
      const importedDs: Diary[] = [];
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("日期|")) return;
        if (trimmed.includes("---思南随记 账单数据---")) { currentSection = "ts"; return; }
        if (trimmed.includes("---思南随记 随笔数据---")) { currentSection = "ds"; return; }
        if (currentSection === "ts") {
          const [d, t, c, a, n] = trimmed.split('|');
          if (d && t && c && a) importedTs.push({ id: Math.random().toString(36).substr(2, 9), date: d, type: (t === 'income' || t === '收入') ? 'income' : 'expense', category: c, categoryGroup: '', amount: parseFloat(a), note: n || '', createdAt: Date.now() });
        } else if (currentSection === "ds") {
          const [d, c] = trimmed.split('|');
          if (d && c) importedDs.push({ date: d, content: c.replace(/\\n/g, '\n') });
        }
      });
      onImportAll(importedTs, importedDs);
      alert('数据同步成功！');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const daysInMonth = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  }, [viewDate]);

  return (
    <div className="space-y-3 pb-8 animate-in fade-in duration-500 relative">
      {/* 语音波纹遮罩 */}
      {isRecording && (
        <div className="fixed inset-0 z-[110] bg-black/5 backdrop-blur-[2px] pointer-events-none flex flex-col items-center justify-center animate-in fade-in">
           <div className="bg-white/90 p-10 rounded-full shadow-2xl flex flex-col items-center gap-6">
              <div className="flex gap-1.5 items-center h-16">
                 {[1,2,3,4,5,6,7,8].map(i => (
                   <div key={i} className={`w-2 bg-red-400 rounded-full animate-bounce`} style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.08}s` }} />
                 ))}
              </div>
              <p className="text-sm font-black text-red-500 tracking-widest uppercase">聆听中...</p>
           </div>
        </div>
      )}

      {showCalendar && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-extrabold text-black">快速切换日期</h3>
              <button onClick={() => setShowCalendar(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 tap-scale"><X size={24} /></button>
            </div>
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-3 bg-slate-50 rounded-2xl tap-scale"><ChevronLeft size={24} /></button>
              <span className="font-extrabold text-lg">{viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月</span>
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-3 bg-slate-50 rounded-2xl tap-scale"><ChevronRight size={24} /></button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center mb-4">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (<div key={d} className="text-xs font-bold text-slate-300">{d}</div>))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {daysInMonth.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="h-12"></div>;
                const dateStr = getLocalDateString(day);
                const isSelected = date === dateStr;
                return (
                  <button key={dateStr} onClick={() => { setDate(dateStr); setShowCalendar(false); }} className={`h-12 flex items-center justify-center rounded-2xl text-sm font-bold transition-all tap-scale ${isSelected ? 'bg-black text-white shadow-xl' : 'text-slate-700 hover:bg-slate-100'}`}>
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 随笔卡片 */}
      <div className="bg-white rounded-[2.2rem] p-6 shadow-sm border border-slate-100 relative">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center">
              <BookOpen size={18} className="text-slate-400" />
            </div>
            <h3 className="text-sm font-extrabold text-black">每日随笔</h3>
          </div>
          <button type="button" onClick={() => setShowCalendar(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 tap-scale">
            <CalendarIcon size={14} className="text-slate-400" />
            <span className="text-[11px] font-extrabold text-black">{date}</span>
          </button>
        </div>
        <textarea 
          value={diaryInput} 
          onChange={e => setDiaryInput(e.target.value)} 
          placeholder="有什么想要记录的心情吗？" 
          className="w-full h-20 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[14px] font-bold outline-none resize-none focus:ring-2 focus:ring-black/5 transition-all text-black placeholder:text-slate-300 mb-4" 
        />
        <div className="flex gap-2">
          <button onClick={handleSaveDiary} className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-4 rounded-2xl font-extrabold text-[13px] shadow-lg shadow-black/10 tap-scale">
            <Save size={18} /> 保存
          </button>
          <button 
            onTouchStart={(e) => handleStartRecording(e, 'diary')}
            onTouchEnd={handleStopRecording}
            onMouseDown={(e) => handleStartRecording(e, 'diary')}
            onMouseUp={handleStopRecording}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-extrabold text-[13px] shadow-md transition-all tap-scale relative overflow-hidden ${isRecording && recordingTarget === 'diary' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {isRecording && recordingTarget === 'diary' ? <MicOff size={18} /> : <Mic size={18} />}
            {isRecording && recordingTarget === 'diary' ? '松开结束' : '按住说话'}
          </button>
          <button onClick={() => setDiaryInput('')} className="w-14 flex items-center justify-center bg-slate-100 text-slate-400 py-4 rounded-2xl border border-slate-200 tap-scale">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* 记账卡片 */}
      <div className="bg-white rounded-[2.2rem] p-6 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center">
              <Wallet size={18} className="text-slate-400" />
            </div>
            <h3 className="text-sm font-extrabold text-black">智能记账</h3>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner w-28">
            <button type="button" onClick={() => { setType('expense'); setCategory('餐饮'); }} className={`flex-1 py-2 rounded-lg font-extrabold text-[11px] transition-all ${type === 'expense' ? 'bg-white shadow-sm text-black' : 'text-slate-400'}`}>支出</button>
            <button type="button" onClick={() => { setType('income'); setCategory('收入'); }} className={`flex-1 py-2 rounded-lg font-extrabold text-[11px] transition-all ${type === 'income' ? 'bg-white shadow-sm text-black' : 'text-slate-400'}`}>收入</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest ml-1">日期</label>
              <button type="button" onClick={() => setShowCalendar(true)} className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-[13px] text-black tap-scale">
                <span className="flex items-center gap-2 truncate"><CalendarIcon size={16} className="text-slate-400" /> {date.slice(5)}</span>
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest ml-1">金额</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-extrabold text-slate-300 text-[14px]">¥</span>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full pl-8 pr-4 py-3.5 bg-slate-50 rounded-2xl border border-slate-100 font-extrabold text-[16px] outline-none focus:ring-2 focus:ring-black/5 text-black placeholder:text-slate-300" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest ml-1">备注/语音解析</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="输入备注或长按右侧按钮语音录入" className="w-full px-4 py-3.5 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-[14px] outline-none focus:ring-2 focus:ring-black/5 text-black placeholder:text-slate-300" />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-4 rounded-2xl font-extrabold text-[13px] shadow-lg shadow-black/10 tap-scale">
              <Save size={18} /> 保存账单
            </button>
            <button 
              type="button"
              onTouchStart={(e) => handleStartRecording(e, 'transaction')}
              onTouchEnd={handleStopRecording}
              onMouseDown={(e) => handleStartRecording(e, 'transaction')}
              onMouseUp={handleStopRecording}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-extrabold text-[13px] shadow-md transition-all tap-scale relative overflow-hidden ${isRecording && recordingTarget === 'transaction' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {isRecording && recordingTarget === 'transaction' && (
                <span className="absolute inset-0 bg-white/20 animate-ping rounded-full" />
              )}
              {isRecording && recordingTarget === 'transaction' ? <MicOff size={18} /> : <Mic size={18} />}
              {isRecording && recordingTarget === 'transaction' ? '正在识别' : '长按记账'}
            </button>
            <button type="button" onClick={resetTransactionForm} className="w-14 flex items-center justify-center bg-slate-100 text-slate-400 py-4 rounded-2xl border border-slate-200 tap-scale">
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="space-y-4 pt-2">
            <label className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest ml-1">详细分类</label>
            <div className="space-y-6 pb-2">
              {type === 'expense' ? CATEGORY_GROUPS.map(group => (
                <div key={group.name} className="space-y-3">
                  <p className="text-[10px] font-extrabold text-slate-400 px-2 border-l-2 border-slate-200 ml-1">{group.name}</p>
                  <div className="grid grid-cols-5 gap-y-4 gap-x-2">
                    {group.items.map(item => (
                      <button key={item.label} type="button" onClick={() => setCategory(item.label)} className={`flex flex-col items-center gap-2 py-1 rounded-2xl transition-all tap-scale ${category === item.label ? 'scale-110 z-10' : 'opacity-40 grayscale-[20%]'}`}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md border-2 border-white" style={{ backgroundColor: item.color }}>
                          {React.cloneElement(item.icon as React.ReactElement<any>, { size: 24, color: (item.label === '电' || item.label === '票务' || item.label === '燃') ? '#333' : 'white', strokeWidth: 2.5 })}
                        </div>
                        <span className="text-[10px] font-extrabold text-black text-center truncate w-full px-0.5">{item.displayLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="grid grid-cols-5 gap-4">
                  <button type="button" onClick={() => setCategory('收入')} className={`flex flex-col items-center gap-2 py-1 rounded-2xl transition-all tap-scale ${category === '收入' ? 'scale-110' : 'opacity-40'}`}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md border-2 border-white" style={{ backgroundColor: INCOME_CATEGORY.color }}>
                      {React.cloneElement(INCOME_CATEGORY.icon as React.ReactElement<any>, { size: 24, color: 'white', strokeWidth: 2.5 })}
                    </div>
                    <span className="text-[10px] font-extrabold text-black">收入</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="bg-white/40 backdrop-blur-md rounded-[2rem] p-4 shadow-sm border border-white/50 flex gap-3">
        <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-4 bg-white/80 text-slate-700 rounded-2xl border border-slate-200/50 font-extrabold text-[12px] tap-scale shadow-sm">
          <Download size={18} className="text-slate-400" /> 数据导入
          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".txt" />
        </button>
        <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 py-4 bg-white/80 text-slate-700 rounded-2xl border border-slate-200/50 font-extrabold text-[12px] tap-scale shadow-sm">
          <Upload size={18} className="text-slate-400" /> 备份导出
        </button>
      </div>
    </div>
  );
};

export default Home;
