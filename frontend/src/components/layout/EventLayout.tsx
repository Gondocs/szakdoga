import { Outlet, useLocation, useParams } from 'react-router-dom';
import { Box } from '@mui/material';
import { EventSubNav } from './EventSubNav';

/**
 * Az esemény aloldalait (Áttekintés, Regisztráltak, Befogadóhelyek, stb.) egy
 * közös elrendezés alá fogja össze, hogy az EventSubNav egyetlen, állandó
 * példányban létezzen — enélkül minden váltáskor újra létrejött, ezért a
 * kiemelt (aktív) gomb szín-/stílusváltása ugrásszerű volt ahelyett, hogy
 * lágyan animálódott volna. Csak a jobb oldali tartalom (az Outlet) cserélődik
 * lapváltáskor, az oldalsáv változatlanul a helyén marad.
 *
 * (Korábban egy külön, keskeny "hero" sávot próbáltunk az oldalsáv mellé
 * tenni csak néhány kiemelt elemnek, a többi tartalmat pedig alá, teljes
 * szélességben — ez viszont minden olyan aloldalon, ami nem tölti ki ezt a
 * sávot, akkora üres helyet hagyott, amekkora az oldalsáv maga, mert egy
 * flex-sorban az oldalsáv magassága határozza meg a sor magasságát attól
 * függetlenül, van-e mellette tartalom. Ezért maradtunk az egyszerű,
 * minden aloldalon egységes elrendezésnél.)
 */
export function EventLayout() {
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();

  if (!eventId) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
      <EventSubNav eventId={eventId} />
      <Box key={location.pathname} className="page-transition" sx={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
