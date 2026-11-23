import { lazy, Suspense, useEffect } from 'react';
import { StoreProvider } from './store/Store';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { useRoute } from './lib/router';
import { hideLaunch } from './lib/pwa';
import { UpsellProvider } from './lib/pro';

// Each screen is its own chunk, so the first launch only downloads what it shows.
const Dashboard = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.Dashboard })));
const LogClimb = lazy(() => import('./screens/LogClimb').then((m) => ({ default: m.LogClimb })));
const SessionSummary = lazy(() => import('./screens/SessionSummary').then((m) => ({ default: m.SessionSummary })));
const Sessions = lazy(() => import('./screens/Sessions').then((m) => ({ default: m.Sessions })));
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })));
const Gyms = lazy(() => import('./screens/Gyms').then((m) => ({ default: m.Gyms })));
const GymDetail = lazy(() => import('./screens/GymDetail').then((m) => ({ default: m.GymDetail })));
const Compare = lazy(() => import('./screens/Compare').then((m) => ({ default: m.Compare })));
const Projects = lazy(() => import('./screens/Projects').then((m) => ({ default: m.Projects })));
const Training = lazy(() => import('./screens/Training').then((m) => ({ default: m.Training })));
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })));
const Report = lazy(() => import('./screens/Report').then((m) => ({ default: m.Report })));
const Pro = lazy(() => import('./screens/Pro').then((m) => ({ default: m.Pro })));

function Loading() {
  return <div role="status" aria-label="Loading" className="flex min-h-[50dvh] items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-route" aria-hidden="true" /></div>;
}

/** Sits inside the Suspense boundary, so it mounts only once the first screen has loaded. */
function Ready() {
  useEffect(() => { hideLaunch(); }, []);
  return null;
}

function Screens() {
  const { path, query } = useRoute();
  const [a, b] = path;
  let section = 'home';
  let el = <Dashboard />;
  if (a === 'log') { section = 'log'; el = <LogClimb editId={b === 'edit' ? path[2] : undefined} key={path.join('/')} />; }
  else if (a === 'session' && b) { section = 'home'; el = <SessionSummary id={b} key={b} />; }
  else if (a === 'sessions') { section = 'home'; el = <Sessions />; }
  else if (a === 'progress') { section = 'progress'; el = <Progress />; }
  else if (a === 'report') { section = 'progress'; el = <Report m={query.get('m')} y={query.get('y')} />; }
  else if (a === 'gyms' && b) { section = 'gyms'; el = <GymDetail id={b} key={b} />; }
  else if (a === 'gyms') { section = 'gyms'; el = <Gyms />; }
  else if (a === 'compare') { section = 'gyms'; el = <Compare a={query.get('a')} b={query.get('b')} />; }
  else if (a === 'projects') { section = 'projects'; el = <Projects focus={query.get('id')} />; }
  else if (a === 'training') { section = 'training'; el = <Training />; }
  else if (a === 'profile') { section = 'profile'; el = <Profile />; }
  else if (a === 'pro') { section = 'profile'; el = <Pro />; }
  return <Layout section={section}><Suspense fallback={<Loading />}><Ready />{el}</Suspense></Layout>;
}

export function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <UpsellProvider>
          <Screens />
        </UpsellProvider>
      </ToastProvider>
    </StoreProvider>
  );
}
