import React from 'react';
import { ArrowLeft, Bell } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { AppNotification } from '../types';

interface TopHeaderProps {
  title: string;
  showBackButton: boolean;
  onBack: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

const TopHeader: React.FC<TopHeaderProps> = ({ title, showBackButton, onBack, notifications, onMarkAsRead, onClearAll }) => {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200 h-16 lg:h-20 flex items-center shrink-0">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <button onClick={onBack} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full">
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">{title}</h1>
          </div>
          <div className="flex items-center">
            <NotificationBell
              notifications={notifications}
              onMarkAsRead={onMarkAsRead}
              onClearAll={onClearAll}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopHeader;