import React from 'react';
import { LayoutGrid, QrCode } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: 'DASHBOARD_MOBILE' | 'ADMIN') => void;
  onScanClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate, onScanClick }) => {
  const overviewItem = { view: 'DASHBOARD_MOBILE', label: 'Overzicht', icon: LayoutGrid } as const;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] z-40">
      <div className="flex justify-around items-center h-16">
        {/* Item 1: Overzicht (Left) */}
        <NavItem
          label={overviewItem.label}
          icon={overviewItem.icon}
          isActive={currentView === overviewItem.view}
          onNavigate={() => onNavigate(overviewItem.view)}
        />

        {/* Item 2: Scan Button (Middle) */}
        <div className="w-16 h-16 flex items-center justify-center">
          <button
            onClick={onScanClick}
            className="w-16 h-16 -mt-8 bg-primary-700 rounded-full text-white flex items-center justify-center shadow-lg shadow-primary-200 hover:bg-primary-800 transition-all transform active:scale-90"
            aria-label="Scan QR Code"
          >
            <QrCode className="w-8 h-8" />
          </button>
        </div>

        {/* Item 3: Empty placeholder for balance (Right) */}
        <div className="w-full h-full" />
      </div>
    </div>
  );
};

interface NavItemProps {
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  onNavigate: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ label, icon: Icon, isActive, onNavigate }) => (
  <button
    onClick={onNavigate}
    className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
      isActive ? 'text-primary-700' : 'text-slate-500 hover:text-primary-700'
    }`}
  >
    <Icon className="w-6 h-6 mb-0.5" />
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

export default BottomNav;