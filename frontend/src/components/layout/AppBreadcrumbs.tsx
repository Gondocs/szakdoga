import { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { fetchEvent, fetchFamily, fetchPerson } from '../../lib/api/endpoints';

const segmentLabels: Record<string, string> = {
  esemenyek: 'Események',
  attekintes: 'Áttekintés',
  szemelyek: 'Regisztráltak',
  'uj-regisztracio': 'Új regisztráció',
  befogadohelyek: 'Befogadóhelyek',
  telepulesek: 'Települések',
  erkeztetes: 'QR érkeztetés',
  szallitas: 'Szállítás',
  jarmuvek: 'Járművek',
  terkep: 'Térkép',
  csaladok: 'Családok',
  egyesites: 'Családegyesítés',
  'rendkivuli-esemenyek': 'Rendkívüli események',
  visszatelepites: 'Visszatelepítés',
  felhasznalok: 'Felhasználók',
  naplo: 'Napló',
  beallitasok: 'Beállítások',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ezeknek a szegmenseknek csak eseményen belül ("esemenyek/:id/szemelyek") van
// listanézetük — önmagukban ("/szemelyek", "/csaladok") nincs, mert azok
// csak a részletnézet (":id") előtagjaként fordulnak elő. Ilyenkor a morzsa
// nem lehet link, mert a cél útvonal nem létezik.
const BARE_DETAIL_ONLY_SEGMENTS = new Set(['szemelyek', 'csaladok']);

export function AppBreadcrumbs() {
  const location = useLocation();
  const [labelCache, setLabelCache] = useState<Record<string, string>>({});

  const segments = location.pathname.split('/').filter(Boolean);

  useEffect(() => {
    segments.forEach((seg, i) => {
      if (!UUID_RE.test(seg) || labelCache[seg]) return;
      const parent = segments[i - 1];
      if (parent === 'esemenyek') {
        fetchEvent(seg).then((e) => setLabelCache((c) => ({ ...c, [seg]: e.name })));
      } else if (parent === 'szemelyek') {
        fetchPerson(seg).then((p) => setLabelCache((c) => ({ ...c, [seg]: p.full_name })));
      } else if (parent === 'csaladok') {
        fetchFamily(seg).then((f) => setLabelCache((c) => ({ ...c, [seg]: f.family_code })));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (segments.length <= 1) return null;

  let runningPath = '';
  const crumbs = segments.map((seg, i) => {
    runningPath += `/${seg}`;
    const label = UUID_RE.test(seg) ? (labelCache[seg] ?? '…') : (segmentLabels[seg] ?? seg);
    // Az esemény azonosítójának önmagában (pl. "/events/:id") nincs saját nézete,
    // ezért a hozzá tartozó morzsa az esemény áttekintő oldalára mutat.
    const isBareEventId = UUID_RE.test(seg) && segments[i - 1] === 'esemenyek';
    const path = isBareEventId ? `${runningPath}/attekintes` : runningPath;
    const clickable = !(i === 0 && BARE_DETAIL_ONLY_SEGMENTS.has(seg));
    return { path, label, clickable };
  });

  return (
    <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
      <Link component={RouterLink} to="/" underline="hover" color="inherit">
        Kezdőlap
      </Link>
      {crumbs.map((crumb, i) =>
        i === crumbs.length - 1 || !crumb.clickable ? (
          <Typography key={crumb.path} color="text.primary" variant="body2">
            {crumb.label}
          </Typography>
        ) : (
          <Link key={crumb.path} component={RouterLink} to={crumb.path} underline="hover" color="inherit" variant="body2">
            {crumb.label}
          </Link>
        )
      )}
    </Breadcrumbs>
  );
}
