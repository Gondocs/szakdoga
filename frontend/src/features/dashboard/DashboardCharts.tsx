import { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme } from '@mui/material';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { DashboardData, RegistrationStatus, RiskLevel, SpecialNeedCategory } from '../../types';
import { specialNeedCategoryLabels } from '../../constants/specialNeeds';
import { fetchRegistrationsTimeline, type TimelineInterval } from '../../lib/api/endpoints';
import { RiskBadge } from '../../components/ui/RiskBadge';

const statusLabels: Record<RegistrationStatus, string> = {
  registered: 'Regisztrált',
  checked_in_assembly: 'Megjelent a gyülekezőponton',
  in_transport: 'Szállítás alatt',
  arrived_shelter: 'Megérkezett',
  left_shelter: 'Elhagyta',
  returned_home: 'Visszatelepült',
  missing: 'Hiányzik',
  cancelled: 'Törölt',
};

const PIE_COLORS = ['#a3172b', '#c9793a', '#4a7a3f', '#3c6e91', '#8a5fb0', '#8c8c8c', '#d4a017', '#5c6bc0'];

const genderLabels: Record<string, string> = { male: 'Férfi', female: 'Nő', other: 'Egyéb' };
const AGE_BUCKET_ORDER = ['0-17', '18-39', '40-59', '60-74', '75+', 'ismeretlen'];

const riskColors: Record<RiskLevel, string> = {
  low: '#4a7a3f',
  medium: '#c9793a',
  high: '#a3172b',
  critical: '#7a0f1f',
};

const intervalLabels: Record<TimelineInterval, string> = {
  '15min': '15 percenként',
  hour: 'Óránként',
  day: 'Naponta',
};

const intervalFormat: Record<TimelineInterval, Intl.DateTimeFormatOptions> = {
  '15min': { hour: '2-digit', minute: '2-digit' },
  hour: { month: 'short', day: 'numeric', hour: '2-digit' },
  day: { month: 'short', day: 'numeric' },
};

// A backend által számolt "hány óra múlva telik be a kapacitás" értéket
// alakítja emberi olvasásra alkalmas szöveggé: percben (1 óránál rövidebb),
// órában, vagy napban (2 napnál hosszabb esetén) fejezi ki az időtartamot
function formatForecast(hours: number | null, intakeRatePerHour: number): string {
  if (hours === null) {
    return 'A jelenlegi ütem mellett nem várható telítődés.';
  }
  if (hours <= 0) {
    return 'A kapacitás betelt.';
  }
  const rateText = `${intakeRatePerHour} fő/óra érkeztetési ütem mellett`;
  if (hours < 1) {
    return `${rateText} kb. ${Math.round(hours * 60)} percen belül telítődik.`;
  }
  if (hours < 48) {
    return `${rateText} kb. ${hours} óra múlva telítődik.`;
  }
  return `${rateText} kb. ${(hours / 24).toFixed(1)} nap múlva telítődik.`;
}

export function DashboardCharts({ data, eventId }: { data: DashboardData; eventId: string }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [interval, setTimelineInterval] = useState<TimelineInterval>('day');
  const [timeline, setTimeline] = useState<{ bucket: string; count: number }[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(true);

  useEffect(() => {
    setIsTimelineLoading(true);
    fetchRegistrationsTimeline(eventId, interval)
      .then(setTimeline)
      .catch(() => setTimeline([]))
      .finally(() => setIsTimelineLoading(false));
  }, [eventId, interval]);

  const timelineData = useMemo(
    () =>
      timeline.map((row) => ({
        label: new Date(row.bucket).toLocaleString('hu-HU', intervalFormat[interval]),
        Regisztrációk: row.count,
      })),
    [timeline, interval]
  );

  const statusData = Object.entries(data.status_breakdown)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: statusLabels[status as RegistrationStatus] ?? status,
      value: count,
    }));

  const specialNeedsData = Object.entries(data.special_needs_by_category)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({
      name: specialNeedCategoryLabels[category as SpecialNeedCategory] ?? category,
      Fő: count,
    }));

  const genderData = Object.entries(data.gender_breakdown)
    .filter(([, count]) => count > 0)
    .map(([gender, count]) => ({
      name: genderLabels[gender] ?? gender,
      value: count,
    }));

  const ageData = AGE_BUCKET_ORDER
    .filter((bucket) => (data.age_breakdown[bucket] ?? 0) > 0)
    .map((bucket) => ({
      name: bucket === 'ismeretlen' ? 'Ismeretlen' : `${bucket} év`,
      Fő: data.age_breakdown[bucket],
    }));

  const utilizationPct = Math.round(data.overall_risk.utilization * 100);
  const gaugeColor = riskColors[data.overall_risk.level];

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
        <Paper variant="outlined" sx={{ p: 3, flex: 0.8, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>Összesített kapacitáskockázat</Typography>
            <RiskBadge level={data.overall_risk.level} />
          </Stack>
          <Box sx={{ position: 'relative', width: '100%', height: isMobile ? 180 : 220, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="72%"
                outerRadius="100%"
                barSize={16}
                startAngle={90}
                endAngle={-270}
                data={[{ name: 'utilization', value: utilizationPct, fill: gaugeColor }]}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar
                  background={{ fill: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#e6e2e0' }}
                  dataKey="value"
                  cornerRadius={8}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h4" fontWeight={700}>{utilizationPct}%</Typography>
              <Typography variant="caption" color="text.secondary">telítettség</Typography>
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Kockázati pontszám: {data.overall_risk.score}
          </Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ mt: 0.5, display: 'block' }}>
            {formatForecast(data.overall_risk.forecast_hours_to_full, data.overall_risk.intake_rate_per_hour)}
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, flex: 1.6, minWidth: 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>Regisztrációk időbeli alakulása</Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={interval}
              onChange={(_, value: TimelineInterval | null) => value && setTimelineInterval(value)}
            >
              {(Object.keys(intervalLabels) as TimelineInterval[]).map((key) => (
                <ToggleButton key={key} value={key}>{intervalLabels[key]}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
          {!isTimelineLoading && timelineData.length === 0 ? (
            <Typography color="text.secondary">Nincs még megjeleníthető adat.</Typography>
          ) : (
            <Box sx={{ width: '100%', height: isMobile ? 220 : 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ left: -20 }}>
                  <defs>
                    <linearGradient id="registrationsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a3172b" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#a3172b" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <RechartsTooltip />
                  <Area
                    type="monotone"
                    dataKey="Regisztrációk"
                    stroke="#a3172b"
                    strokeWidth={2}
                    fill="url(#registrationsGradient)"
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
        <Paper variant="outlined" sx={{ p: 3, flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Státusz megoszlás</Typography>
          {statusData.length === 0 ? (
            <Typography color="text.secondary">Nincs még megjeleníthető adat.</Typography>
          ) : (
            <Box sx={{ width: '100%', height: isMobile ? 220 : 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={isMobile ? 45 : 55}
                    outerRadius={isMobile ? 70 : 85}
                    paddingAngle={2}
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {statusData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>

        {specialNeedsData.length > 0 && (
          <Paper variant="outlined" sx={{ p: 3, flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Speciális igények</Typography>
            <Box sx={{ width: '100%', height: Math.max(isMobile ? 220 : 260, specialNeedsData.length * 42) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={specialNeedsData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis dataKey="name" type="category" width={isMobile ? 110 : 170} fontSize={12} tickLine={false} />
                  <RechartsTooltip />
                  <Bar dataKey="Fő" fill="#a3172b" radius={[0, 4, 4, 0]} animationDuration={900} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
        {genderData.length > 0 && (
          <Paper variant="outlined" sx={{ p: 3, flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Nem szerinti megoszlás</Typography>
            <Box sx={{ width: '100%', height: isMobile ? 220 : 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={isMobile ? 45 : 55}
                    outerRadius={isMobile ? 70 : 85}
                    paddingAngle={2}
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {genderData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        )}

        {ageData.length > 0 && (
          <Paper variant="outlined" sx={{ p: 3, flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Kor szerinti megoszlás</Typography>
            <Box sx={{ width: '100%', height: isMobile ? 220 : 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <RechartsTooltip />
                  <Bar dataKey="Fő" fill="#3c6e91" radius={[4, 4, 0, 0]} animationDuration={900} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        )}
      </Stack>
    </Stack>
  );
}
