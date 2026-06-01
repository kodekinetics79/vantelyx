import { useEffect, useState } from 'react';
import {
  Archive,
  Bot,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileSignature,
  Gauge,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  PenTool,
  RefreshCw,
  ScrollText,
  Sparkles,
  UploadCloud,
  Building2
} from 'lucide-react';
import Layout from './components/Layout';
import CommandCenter from './pages/CommandCenter';
import Copilot from './pages/Copilot';
import AIIntake from './pages/AIIntake';
import Repository from './pages/Repository';
import ContractWorkspace from './pages/ContractWorkspace';
import Authoring from './pages/Authoring';
import Templates from './pages/Templates';
import WorkQueue from './pages/WorkQueue';
import Obligations from './pages/Obligations';
import Renewals from './pages/Renewals';
import CalendarControl from './pages/CalendarControl';
import Vendors from './pages/Vendors';
import ESign from './pages/ESign';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
import Login from './pages/Login';
import { getSessionUser, isAuthenticated, logout } from './services/authService';
import { LogOut } from 'lucide-react';
import { seedSecurityData } from './services/securityService';
import { seedDemoData } from './services/vantelyxData';
import { seedExecutionData } from './services/executionService';
import { seedTaskData } from './services/taskService';
import { seedTemplateStudioData } from './services/templateService';

type Route =
  | 'command' | 'copilot' | 'intake' | 'repository' | 'workspace' | 'authoring'
  | 'templates' | 'workqueue' | 'obligations' | 'renewals' | 'calendar'
  | 'vendors' | 'esign' | 'analytics' | 'admin';

const WORKSPACE_KEY = 'vantelyx_selected_contract_id';

const nav: Array<{ key: Route; label: string; icon: JSX.Element; badge?: string }> = [
  { key: 'command', label: 'Command Center', icon: <LayoutDashboard size={18} /> },
  { key: 'copilot', label: 'AI Copilot', icon: <Bot size={18} />, badge: 'AI' },
  { key: 'intake', label: 'AI Intake', icon: <UploadCloud size={18} /> },
  { key: 'repository', label: 'Repository', icon: <Archive size={18} /> },
  { key: 'workspace', label: 'Contract Workspace', icon: <ScrollText size={18} /> },
  { key: 'authoring', label: 'Authoring', icon: <PenTool size={18} /> },
  { key: 'templates', label: 'Template Studio', icon: <Sparkles size={18} /> },
  { key: 'workqueue', label: 'Work Queue', icon: <ListTodo size={18} /> },
  { key: 'obligations', label: 'Obligations', icon: <ClipboardCheck size={18} /> },
  { key: 'renewals', label: 'Renewals', icon: <RefreshCw size={18} /> },
  { key: 'calendar', label: 'Calendar', icon: <CalendarDays size={18} /> },
  { key: 'vendors', label: 'Vendors', icon: <Building2 size={18} /> },
  { key: 'esign', label: 'E-Signature', icon: <FileSignature size={18} /> },
  { key: 'analytics', label: 'Analytics', icon: <Gauge size={18} /> },
  { key: 'admin', label: 'Admin & Security', icon: <LockKeyhole size={18} /> }
];

const validRoutes = new Set<string>(nav.map((item) => item.key));

function routeFromHash(): Route {
  const raw = window.location.hash.replace(/^#/, '');
  return (validRoutes.has(raw) ? raw : 'command') as Route;
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [authed, setAuthed] = useState<boolean>(isAuthenticated);

  // Seed demo data once so every module has realistic content on first load.
  useEffect(() => {
    try {
      seedSecurityData();
      seedDemoData();
      seedExecutionData();
      seedTaskData();
      seedTemplateStudioData();
    } catch (error) {
      console.warn('[App] Demo seeding skipped:', error);
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const go = (key: Route) => {
    window.location.hash = `#${key}`;
    setRoute(key);
  };

  const openWorkspace = (contractId: string) => {
    window.localStorage.setItem(WORKSPACE_KEY, contractId);
    go('workspace');
  };

  const renderPage = () => {
    switch (route) {
      case 'command': return <CommandCenter />;
      case 'copilot': return <Copilot />;
      case 'intake': return <AIIntake onNavigateRepository={() => go('repository')} />;
      case 'repository': return <Repository onOpenContractWorkspace={openWorkspace} />;
      case 'workspace': return <ContractWorkspace />;
      case 'authoring': return <Authoring />;
      case 'templates': return <Templates />;
      case 'workqueue': return <WorkQueue />;
      case 'obligations': return <Obligations />;
      case 'renewals': return <Renewals />;
      case 'calendar': return <CalendarControl />;
      case 'vendors': return <Vendors />;
      case 'esign': return <ESign />;
      case 'analytics': return <Analytics />;
      case 'admin': return <Admin />;
      default: return <CommandCenter />;
    }
  };

  if (!authed) {
    return <Login onAuthenticated={() => setAuthed(true)} />;
  }

  const sessionUser = getSessionUser();
  const signOut = () => {
    logout();
    setAuthed(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex">
        <div className="flex items-center gap-3 px-3 pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-black text-white shadow-glow">V</div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Vantelyx</p>
            <p className="text-lg font-black tracking-tight text-slate-950">CLM Suite</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => go(item.key)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition ${
                route === item.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-black text-brand-700">{item.badge}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="mt-4 border-t border-slate-200 px-3 pt-4">
          <p className="truncate text-sm font-black text-slate-900">{sessionUser.fullName}</p>
          <p className="truncate text-xs text-slate-500">{sessionUser.email}</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1">
        <Layout title={nav.find((item) => item.key === route)?.label}>{renderPage()}</Layout>
      </div>
    </div>
  );
}
