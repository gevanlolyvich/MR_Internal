import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import api from '../../api/client';
import { Card, PageHeader, Spinner, EmptyState } from '../../components/ui/Common';
import { useAuth } from '../../contexts/AuthContext';
import { STATUS_LABEL, RISK_LEVEL_COLORS } from '../../constants';

const CARDS = [
  { key: 'total_risk', label: 'Total Risk', color: 'bg-primary-700' },
  { key: 'active_risk', label: 'Active Risk', color: 'bg-jxb-green' },
  { key: 'waiting_owner', label: 'Waiting Owner Approval', color: 'bg-amber-500' },
  { key: 'waiting_mr', label: 'Waiting MR Approval', color: 'bg-primary-500' },
  { key: 'rejected_risk', label: 'Rejected Risk', color: 'bg-jxb-red' },
  { key: 'extreme_risk', label: 'Extreme Risk', color: 'bg-jxb-red' },
  { key: 'high_risk', label: 'High Risk', color: 'bg-jxb-orange' },
  { key: 'moderate_risk', label: 'Moderate Risk', color: 'bg-jxb-yellow' },
  { key: 'low_risk', label: 'Low Risk', color: 'bg-jxb-green' },
];

function ChartCard({ title, children, empty }) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {empty ? (
        <EmptyState title="Belum ada data" />
      ) : (
        <div className="h-64">{children}</div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/dashboard')
      .then((res) => setData(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState title="Gagal memuat dashboard" />;

  const c = data.cards;
  const ch = data.charts;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Ringkasan risiko${user?.branch_name ? ` — ${user.branch_name}` : ''}`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {CARDS.map((card) => (
          <div key={card.key} className="card overflow-hidden">
            <div className={`h-1.5 ${card.color}`} />
            <div className="px-4 py-3">
              <p className="text-2xl font-bold text-slate-800">{c[card.key] ?? 0}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{card.label}</p>
            </div>
          </div>
        ))}
        <div className="card overflow-hidden">
          <div className="h-1.5 bg-slate-400" />
          <div className="px-4 py-3">
            <p className="text-2xl font-bold text-slate-800">{c.within_tolerance ?? 0}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">Within Risk Tolerance</p>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="h-1.5 bg-jxb-red" />
          <div className="px-4 py-3">
            <p className="text-2xl font-bold text-slate-800">{c.exceeds_tolerance ?? 0}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">Exceeds Risk Tolerance</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Risk by Category" empty={!ch.by_category.length}>
          <ResponsiveContainer>
            <BarChart data={ch.by_category} layout="vertical" margin={{ left: 20, right: 16 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Risk by Branch" empty={!ch.by_branch.length}>
          <ResponsiveContainer>
            <BarChart data={ch.by_branch} margin={{ left: -20, right: 16 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Risk by Level (After Mitigation)" empty={!ch.by_level.length}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={ch.by_level} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {ch.by_level.map((entry) => (
                  <Cell key={entry.label} fill={RISK_LEVEL_COLORS[entry.label] || entry.color || '#94a3b8'} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Risk by Status" empty={!ch.by_status.length}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={ch.by_status} dataKey="value" nameKey="label" outerRadius={95}>
                {ch.by_status.map((entry, i) => (
                  <Cell
                    key={entry.label}
                    fill={['#1d4ed8', '#eab308', '#dc2626', '#2563eb', '#ef4444', '#22c55e', '#64748b'][i % 7]}
                  />
                ))}
              </Pie>
              <Legend
                formatter={(value) => STATUS_LABEL[value] || value}
              />
              <Tooltip formatter={(v, n) => [v, STATUS_LABEL[n] || n]} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Risk per Year" empty={!ch.by_year.length}>
          <ResponsiveContainer>
            <LineChart data={ch.by_year} margin={{ left: -20, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
