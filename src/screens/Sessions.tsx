import { useMemo, useState } from 'react';
import { useStore } from '../store/Store';
import { Empty, H1, cx, inputCls } from '../components/ui';
import { sessionInfo } from '../lib/stats';
import { fmtDayYear, fmtWeekday, monthKey, fmtMonth } from '../lib/dates';
import { gradeLabel } from '../lib/grades';
import { href } from '../lib/router';

export function Sessions() {
  const { data, gymById } = useStore();
  const [gym, setGym] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const gymIds = Array.from(new Set(data.sessions.map((s) => s.gymId)));
  const list = useMemo(() => data.sessions
    .filter((s) => (!gym || s.gymId === gym) && (!from || s.startedAt.slice(0, 10) >= from) && (!to || s.startedAt.slice(0, 10) <= to))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((s) => sessionInfo(s, data.climbs)), [data.sessions, data.climbs, gym, from, to]);
  const groups: { key: string; label: string; items: typeof list }[] = [];
  list.forEach((i) => {
    const k = monthKey(i.session.startedAt);
    let g = groups.find((x) => x.key === k);
    if (!g) { g = { key: k, label: fmtMonth(i.session.startedAt), items: [] }; groups.push(g); }
    g.items.push(i);
  });
  return (
    <div className="flex flex-col gap-5">
      <H1 sub={list.length + ' sessions' + (data.user.isDemo ? ' · sample data' : '')}>Session history</H1>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Gym
          <select className={inputCls} value={gym} onChange={(e) => setGym(e.target.value)}>
            <option value="">All gyms</option>
            {gymIds.map((id) => <option key={id} value={id}>{gymById(id)?.name ?? id}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">From
          <input type="date" className={inputCls} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">To
          <input type="date" className={inputCls} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {list.length === 0 && <Empty title="No sessions match" body="Try another gym or date range." />}
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-2" aria-label={g.label}>
          <h2 className="m-0 font-mono text-xs uppercase tracking-[0.1em] text-muted">{g.label} · {g.items.length}</h2>
          {g.items.map((r) => (
            <a key={r.session.id} href={href('/session/' + r.session.id)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-ink no-underline">
              <span className="flex w-12 flex-col items-center font-mono">
                <span className="text-[11px] text-muted">{fmtWeekday(r.session.startedAt).toUpperCase()}</span>
                <span className="text-lg font-bold">{new Date(r.session.startedAt).getDate()}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">{gymById(r.session.gymId)?.name}</span>
                <span className="text-xs text-muted">{fmtDayYear(r.session.startedAt)} · {r.climbs.length} climbs · {r.sends} sends</span>
              </span>
              <span className="flex flex-col items-end font-display font-extrabold">
                {r.topB != null && <span className="text-boulder">{gradeLabel('boulder', r.topB)}</span>}
                {r.topR != null && <span className={cx('text-route')}>{gradeLabel('route', r.topR)}</span>}
              </span>
            </a>
          ))}
        </section>
      ))}
    </div>
  );
}
