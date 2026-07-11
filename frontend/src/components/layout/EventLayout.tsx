import { Outlet, useLocation, useParams } from 'react-router-dom';
import { Box } from '@mui/material';
import { EventSubNav } from './EventSubNav';

/**
 * Az esemény aloldalait (Áttekintés, Regisztráltak, Befogadóhelyek, stb.) egy
 * közös elrendezés alá fogja össze, hogy az EventSubNav egyetlen, állandó
 * példányban létezzen — enélkül minden váltáskor újra létrejött, ezért a
 * kiemelt (aktív) gomb szín-/stílusváltása ugrásszerű volt ahelyett, hogy
 * lágyan animálódott volna. Csak a fejléc alatti tartalom (az Outlet) cserélődik
 * lapváltáskor, a navigációs sáv változatlanul a helyén marad.
 */
export function EventLayout() {
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();

  if (!eventId) return null;

  return (
    <Box>
      <EventSubNav eventId={eventId} />
      <Box key={location.pathname} className="page-transition">
        <Outlet />
      </Box>
    </Box>
  );
}
