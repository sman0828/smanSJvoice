import React, { useState, useMemo, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { PlusCircle, Calendar, List, Wallet } from 'lucide-react';
import Home from './pages/Home';
import CalendarPage from './pages/CalendarPage';
import Details from './pages/Details';
import { Transaction, Diary } from './types';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('sman_transactions_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [diaries, setDiaries] = useState<Diary[]>(() => {
    const saved = localStorage.getItem('sman_diaries_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const ROUTES = ['/', '/calendar', '/details'];

  useEffect(() => {
    localStorage.setItem('sman_transactions_v2', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('sman_diaries_v2', JSON.stringify(diaries));
  }, [diaries]);

  const addTransaction = (t: Transaction) => {
    setTransactions(prev => [t, ...prev]);
  };

  const handleImportAll = (newTs: Transaction[], newDiaries: Diary[]) => {
    setTransactions(prev => [...newTs, ...prev]);
    setDiaries(prev => {
      const merged = [...prev];
      newDiaries.forEach(nd => {
        const existingIdx = merged.findIndex(d => d.date === nd.date);
        if (existingIdx > -1) {
          merged[existingIdx] = nd;
        } else {
          merged.push(nd);
        }
      });
      return merged;
    });
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const saveDiary = (date: string, content: string) => {
    setDiaries(prev => {
      const filtered = prev.filter(d => d.date !== date);
      return content.trim() ? [...filtered, { date, content }] : filtered;
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };
    const dx = touchEnd.x - touchStart.current.x;
    const dy = touchEnd.y - touchStart.current.y;

    if (Math.abs(dx) > 75 && Math.abs(dy) < 50) {
      const currentPath = location.pathname || '/';
      let currentIndex = ROUTES.findIndex(route => 
        route === '/' ? currentPath === '/' : currentPath.startsWith(route)
      );
      if (currentIndex === -1) currentIndex = 0;
      if (dx < 0) {
        const nextIndex = (currentIndex + 1) % ROUTES.length;
        navigate(ROUTES[nextIndex]);
      } else {
        const prevIndex = (currentIndex - 1 + ROUTES.length) % ROUTES.length;
        navigate(ROUTES[prevIndex]);
      }
    }
    touchStart.current = null;
  };

  return (
    <div 
      className="flex flex-col min-h-screen max-w-md mx-auto bg-[#F2F0EB] relative safe-bottom"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 px-5 pt-12 pb-3 border-b border-slate-200/50 safe-top">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="bg-black p-2 rounded-xl shadow-lg shadow-black/10">
              <Wallet size={18} className="text-white" />
            </div>
            <h1 className="text-lg font-extrabold tracking-tight text-black">思南随记</h1>
          </div>
        </div>
        
        <nav className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/30">
          <TopNavLink to="/" icon={<PlusCircle />} label="记录" />
          <TopNavLink to="/calendar" icon={<Calendar />} label="日历" />
          <TopNavLink to="/details" icon={<List />} label="明细" />
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-12 hide-scrollbar">
        <Routes>
          <Route path="/" element={
            <Home 
              transactions={transactions} 
              diaries={diaries}
              onAdd={addTransaction} 
              onImportAll={handleImportAll}
              onSaveDiary={saveDiary}
            />
          } />
          <Route path="/calendar" element={<CalendarPage transactions={transactions} diaries={diaries} onSaveDiary={saveDiary} />} />
          <Route path="/details" element={
            <Details 
              transactions={transactions} 
              onDelete={deleteTransaction} 
              diaries={diaries} 
              onSaveDiary={saveDiary}
            />
          } />
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

const TopNavLink: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to === '/details' && location.pathname.startsWith('/details'));
  return (
    <Link 
      to={to} 
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-300 tap-scale ${isActive ? 'bg-white shadow-md text-black' : 'text-slate-400'}`}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { size: 18, strokeWidth: isActive ? 2.5 : 2 })}
      <span className={`text-xs font-bold ${isActive ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    </Link>
  );
};

export default App;