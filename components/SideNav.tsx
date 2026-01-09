import React from 'react';
import { LayoutDashboard, Settings, ShieldCheck } from 'lucide-react';

interface SideNavProps {
  currentView: string;
  onNavigate: (view: 'DASHBOARD' | 'ADMIN') => void;
}

const SideNav: React.FC<SideNavProps> = ({ currentView, onNavigate }) => {
  const navItems = [
    { view: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { view: 'ADMIN', label: 'Beheer', icon: Settings },
  ];

  return (
    <nav className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 p-4">
      <div className="flex items-center gap-2 px-2 pb-4 border-b border-slate-100">
        <ShieldCheck className="w-8 h-8 text-primary-700" />
        <span className="font-bold text-lg text-slate-800">Smart-Grid</span>
      </div>
      <div className="flex-1 mt-4">
        {navItems.map(item => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-primary-100 text-primary-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default SideNav;