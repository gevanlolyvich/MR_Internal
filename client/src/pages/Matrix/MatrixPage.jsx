import { useEffect, useState } from 'react';
import clsx from 'clsx';
import api, { parseError } from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState } from '../../components/ui/Common';
import { useToast } from '../../contexts/ToastContext';

export default function MatrixPage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('after'); // after | inherent

  useEffect(() => {
    api
      .get('/matrix')
      .then((res) => setData(res.data.data))
      .catch((err) => toast.error(parseError(err).message))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState title="Gagal memuat matrix" />;

  const levelOf = (score) => data.levels.find((l) => score >= l.min_score && score <= l.max_score);
  const likelihoods = [...data.likelihood].sort((a, b) => b.score - a.score); // 5 di atas
  const impacts = [...data.impact].sort((a, b) => a.score - b.score); // 1 di kiri
  const cells = mode === 'after' ? data.cells : data.inherent_cells;

  return (
    <div>
      <PageHeader
        title="Risk Matrix (5 × 5)"
        subtitle="Score = Likelihood × Impact. Warna mengikuti master Risk Level; konfigurasi Risk Tolerance dari Master Data."
        actions={
          <div className="flex rounded-md border border-slate-300 bg-white p-0.5">
            <button
              className={clsx('rounded px-3 py-1.5 text-xs font-semibold', mode === 'inherent' ? 'bg-primary-700 text-white' : 'text-slate-600')}
              onClick={() => setMode('inherent')}
            >
              Inherent
            </button>
            <button
              className={clsx('rounded px-3 py-1.5 text-xs font-semibold', mode === 'after' ? 'bg-primary-700 text-white' : 'text-slate-600')}
              onClick={() => setMode('after')}
            >
              After Mitigation
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-x-auto p-4 lg:col-span-2">
          <table className="w-full min-w-[560px] border-collapse text-center text-sm">
            <thead>
              <tr>
                <th className="p-2 text-xs font-bold uppercase tracking-wide text-slate-500" rowSpan={2}>
                  Likelihood ↓ / Impact →
                </th>
                {impacts.map((i) => (
                  <th key={i.score} className="border border-slate-200 bg-slate-50 p-2">
                    <p className="text-sm font-bold">{i.score}</p>
                    <p className="text-[11px] font-normal text-slate-500">{i.name}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {likelihoods.map((l) => (
                <tr key={l.score}>
                  <th className="border border-slate-200 bg-slate-50 p-2 text-left">
                    <p className="text-sm font-bold">{l.score}</p>
                    <p className="text-[11px] font-normal text-slate-500">{l.name}</p>
                  </th>
                  {impacts.map((i) => {
                    const score = l.score * i.score;
                    const lv = levelOf(score);
                    const within = score <= data.tolerance.max_score;
                    const count = cells[`${l.score}-${i.score}`] || 0;
                    return (
                      <td
                        key={i.score}
                        className={clsx(
                          'relative border border-white p-3 text-white transition',
                          !within && 'ring-2 ring-inset ring-slate-900/40'
                        )}
                        style={{ backgroundColor: lv?.color || '#94a3b8' }}
                        title={`${lv?.level} — ${score} (${l.score} × ${i.score})${count ? ` — ${count} risiko` : ''}`}
                      >
                        <p className="text-lg font-black leading-none">{score}</p>
                        <p className="mt-1 text-[10px] font-semibold uppercase opacity-90">{lv?.level}</p>
                        {count > 0 && (
                          <span className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">
                            {count}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">
            Angka kecil pojok kanan atas = jumlah Risk Cause ({mode === 'after' ? 'Risk After Mitigation' : 'Inherent'}).
            Sel bergaris = melebihi Risk Tolerance (skor &gt; {data.tolerance.max_score}).
          </p>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Risk Level</h3>
            <ul className="space-y-2">
              {data.levels.map((l) => (
                <li key={l.min_score} className="flex items-center gap-3 text-sm">
                  <span className="h-5 w-5 rounded" style={{ backgroundColor: l.color }} />
                  <span className="font-semibold">{l.level}</span>
                  <span className="text-slate-400">
                    skor {l.min_score}–{l.max_score}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Risk Tolerance</h3>
            <p className="text-sm text-slate-600">
              Skor <b>≤ {data.tolerance.max_score}</b> → Within Risk Tolerance
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Skor <b>&gt; {data.tolerance.max_score}</b> → Exceeds Risk Tolerance
            </p>
            {data.tolerance.note && (
              <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-xs text-slate-500">{data.tolerance.note}</p>
            )}
            <p className="mt-3 text-[11px] text-slate-400">
              Dapat diubah di Master Data → Risk Tolerance (tidak mengubah alur approval).
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Skala</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="mb-1 font-bold uppercase text-slate-400">Likelihood</p>
                {[...data.likelihood].sort((a, b) => b.score - a.score).map((l) => (
                  <p key={l.score}>{l.score} = {l.name}</p>
                ))}
              </div>
              <div>
                <p className="mb-1 font-bold uppercase text-slate-400">Impact</p>
                {[...data.impact].sort((a, b) => a.score - b.score).map((i) => (
                  <p key={i.score}>{i.score} = {i.name}</p>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
