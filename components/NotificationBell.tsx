import React, { useState } from 'react';
import { Bell, X, Check, AlertTriangle, WifiOff, Info } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationBellProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ notifications, onMarkAsRead, onClearAll }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch(type) {
      case 'ALERT': return <div className="w-8 h-8 rounded-full bg-Danger-50 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-Danger-600" /></div>;
      case 'WARNING': return <div className="w-8 h-8 rounded-full bg-Warning-50 flex items-center justify-center"><WifiOff className="w-5 h-5 text-Warning-600" /></div>;
      default: return <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center"><Info className="w-5 h-5 text-primary-700" /></div>;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-Danger opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-Danger-600 ring-2 ring-white"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 text-sm">Notificaties</h3>
              {notifications.length > 0 && (
                 <button onClick={onClearAll} className="text-xs text-slate-500 hover:text-primary-700 font-medium">
                   Alles wissen
                 </button>
              )}
            </div>
            
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm">Geen nieuwe meldingen</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {notifications.map((notif) => (
                    <li 
                      key={notif.id} 
                      className={`p-4 hover:bg-slate-50 transition-colors flex gap-3 ${!notif.read ? 'bg-primary-50' : ''}`}
                    >
                      <div className="shrink-0">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className={`text-sm ${!notif.read ? 'font-semibold text-slate-800' : 'font-medium text-slate-600'}`}>
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                             {new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {notif.message}
                        </p>
                        {!notif.read && (
                          <button 
                            onClick={() => onMarkAsRead(notif.id)}
                            className="mt-2 text-xs flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium"
                          >
                            <Check className="w-3 h-3" /> Markeer als gelezen
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;