import { type ReactNode, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead
} from '../services/taskService';

type LayoutProps = {
  children: ReactNode;
  title?: string;
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const severityTone = {
  info: 'border-slate-200 bg-slate-50 text-slate-700',
  warning: 'border-amber-100 bg-amber-50 text-amber-700',
  critical: 'border-red-100 bg-red-50 text-red-700'
};

export default function Layout({ children, title = 'Vantelyx CLM' }: LayoutProps) {
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const notifications = useMemo(() => getNotifications().slice(0, 12), [refresh]);
  const unreadCount = useMemo(() => getUnreadNotificationCount(), [refresh]);

  const onRead = (id: string) => {
    markNotificationRead(id);
    setRefresh((value) => value + 1);
  };

  const onReadAll = () => {
    markAllNotificationsRead();
    setRefresh((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-30 border-b border-brand-800 bg-brand-700">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-200">Vantelyx CLM</p>
            <h1 className="text-xl font-black text-white">{title}</h1>
          </div>

          <div className="relative">
            <button
              onClick={() => setOpen((value) => !value)}
              className="relative rounded-md border border-white/20 bg-brand-600 p-2 text-white transition hover:bg-brand-500"
              aria-label="Open notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </button>

            {open ? (
              <div className="absolute right-0 z-40 mt-2 w-[460px] rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-black text-slate-900">Notifications</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-500">Unread: {unreadCount}</p>
                    <button onClick={onReadAll} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700">
                      Mark all read
                    </button>
                  </div>
                </div>

                <div className="max-h-[440px] space-y-2 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                      No notifications right now. Workflow alerts will appear here as approvals, obligations, renewals, and SLA escalations occur.
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div key={notification.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">{notification.title}</p>
                            <p className="mt-1 text-xs text-slate-600">{notification.message}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className={`rounded-full border px-2 py-0.5 font-bold ${severityTone[notification.severity]}`}>{notification.severity.toUpperCase()}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">{notification.source}</span>
                              {notification.contractTitle || notification.contractId ? (
                                <button
                                  onClick={() => {
                                    if (notification.contractId) window.localStorage.setItem('vantelyx_selected_contract_id', notification.contractId);
                                    window.location.hash = '#workspace';
                                    setOpen(false);
                                  }}
                                  className="rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 font-semibold text-brand-700"
                                >
                                  {notification.contractTitle ?? notification.contractId}
                                </button>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                              {notification.type.replace(/_/g, ' ')} · {formatDateTime(notification.createdAt)}
                            </p>
                          </div>
                          {!notification.read ? (
                            <button onClick={() => onRead(notification.id)} className="rounded-lg bg-brand-600 px-2 py-1 text-[11px] font-bold text-white">
                              Mark read
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-700">Read</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-6">{children}</main>
    </div>
  );
}
