import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

interface GuideSection {
  id: string;
  title: string;
  roles?: string[];
  summary: string;
  steps: string[];
  link?: { to: string; label: string };
}

const sections: GuideSection[] = [
  {
    id: 'esemenyek',
    title: '1. Esemény létrehozása és kezelése',
    roles: ['Rendszergazda', 'Műveleti vezető'],
    summary: 'Minden munka egy „eseményhez” (pl. egy konkrét kitelepítéshez) kapcsolódik. Ez az első lépés egy új helyzet kezelésének megkezdésekor.',
    steps: [
      'Nyissa meg az Események listát, és hozzon létre egy új eseményt kóddal és névvel.',
      'Az esemény szerkesztésekor rendeljen hozzá befogadóhelyeket, mindegyikhez egyedi kapacitás-korláttal.',
      'Amíg az esemény „Tervezet” státuszban van, a többi felhasználó még nem dolgozhat vele — állítsa „Aktívra”, amikor minden elő van készítve.',
      'Az esemény lezárásakor („Lezárt” státusz) a hozzá tartozó adatok a jogszabályi megőrzési idő után automatikusan törlődnek.',
    ],
    link: { to: '/esemenyek', label: 'Események listája' },
  },
  {
    id: 'dashboard',
    title: '2. Esemény dashboard (áttekintés)',
    summary: 'Egy adott esemény állapotát élőben (WebSocketen, frissítés nélkül) mutató vezérlőpult — érdemes ezt figyelni a helyzet alatt.',
    steps: [
      'Regisztráltak, családok, megérkezettek és hiányzók száma egy pillantásra — a „Hiányzók” kártyára kattintva rögtön a szűrt névsor nyílik meg.',
      'Befogadóhelyi kapacitás- és kockázat-táblázat: telítettség %-ban és kockázati szint (Alacsony/Közepes/Magas) szerint, hogy időben irányítható legyen az elosztás.',
      'Napi készletigény-előrejelzés (étkezés, speciális diéta, gyógyszerre szorulók) — kattintható mutatók, amelyek a pontos névsort is megnyitják.',
      'A kezdő lépések kártya (amíg egy esemény még üres) végigvezet a legfontosabb első teendőkön.',
    ],
  },
  {
    id: 'regisztracio',
    title: '3. Helyszíni regisztráció és önkiszolgáló előregisztráció',
    roles: ['Regisztrátor'],
    summary: 'A lakosság kétféleképpen kerülhet be a rendszerbe: helyszíni regisztrációval, vagy saját maga által, otthonról.',
    steps: [
      'Helyszíni felvételhez használja a Regisztrációs varázslót: személyes adatok, cím (kereshető településlistából), család hozzárendelése, egyedi igények rögzítése.',
      'A regisztráció végén a rendszer QR-kódot állít elő — ezt a személy a telefonján tárolhatja, vagy ki lehet nyomtatni.',
      'Otthoni, bejelentkezés nélküli regisztrációhoz ossza meg az esemény dashboardján található önkiszolgáló linket (pl. Facebook-oldalon, önkormányzati hirdetményben).',
      'Az önkiszolgálón keresztül regisztrált személy saját profilján később módosíthatja/megerősítheti adatait, publikus azonosító alapján.',
    ],
  },
  {
    id: 'erkeztetes',
    title: '4. QR érkeztetés és befogadóhelyek',
    roles: ['Regisztrátor', 'Befogadóhelyi kezelő'],
    summary: 'A QR-kód a teljes folyamat gerince: felszálláskor, leszálláskor és a befogadóhelyre érkezéskor is ezt olvassák be.',
    steps: [
      'A QR érkeztetés felületen egy kód beolvasása azonnal megjeleníti a személy adatait, beleértve az egyedi igényeket is (pl. mozgáskorlátozottság figyelmeztető ikonnal).',
      'A Befogadóhelyek oldalon az érkező személyt konkrét ágyhoz/helyhez lehet rendelni.',
      'Ha egy család tagjai különböző befogadóhelyekre kerülnek, a rendszer automatikusan figyelmeztet erre az érkeztetéskor.',
      'A befogadóhely aktuális névsora bármikor megnyitható és nyomtatható (böngésző nyomtatás/PDF).',
    ],
    link: { to: '/befogadohelyek', label: 'Befogadóhelyek kezelése' },
  },
  {
    id: 'szallitas',
    title: '5. Szállítás nyomon követése',
    roles: ['Kísérő', 'Regisztrátor'],
    summary: 'Központi szállítóeszközök (pl. buszok) útvonalának és utaslistájának kezelése.',
    steps: [
      'Vegyen fel egy szállítóeszközt megnevezéssel, kapacitással, kísérő személlyel, induló és cél befogadóhellyel.',
      'A gyülekezőponton QR-kóddal rögzítse a felszálló utasokat — a rendszer élőben mutatja a fedélzeten lévők számát.',
      'Útközben a „Pozíció szimulálása” funkcióval frissíthető a jármű helyzete, ami a térképen élőben követhető.',
      'Érkezéskor a „Leszállás rögzítése” gombbal jelezze az utasok leszállását, ezután kezdődhet a befogadóhelyi érkeztetés.',
    ],
  },
  {
    id: 'terkep',
    title: '6. Térkép és gyülekezőpontok',
    summary: 'Térképes áttekintés az esemény szereplőiről és helyszíneiről.',
    steps: [
      'A térképen élőben követhetők a mozgó szállítóeszközök, valamint megjelennek a befogadóhelyek és gyülekezőpontok.',
      'Gyülekezőpontokat (pl. találkozási helyszínek a lakosság számára) az esemény alatt bármikor felvehet vagy módosíthat.',
    ],
  },
  {
    id: 'csaladok',
    title: '7. Családok és családegyesítés',
    roles: ['Műveleti vezető'],
    summary: 'A rendszer családi kötelékként kezeli az együtt regisztrált személyeket, és jelzi, ha egy család szétszakad.',
    steps: [
      'A Családok listán áttekinthető, mely családok vannak jelenleg együtt vagy szétszórva több befogadóhelyen.',
      'Ha egy család tagjai eltérő befogadóhelyre kerülnek, a Családegyesítési munkalistán megjelenik az eset egy térképpel, hogy hol tartózkodnak jelenleg a tagok.',
      'Az esethez ügyintézési bejegyzés (pl. „átszállítás szervezés alatt”) rögzíthető, majd megoldottként lezárható.',
    ],
  },
  {
    id: 'incidensek',
    title: '8. Rendkívüli események (incidensek)',
    roles: ['Befogadóhelyi kezelő', 'Műveleti vezető'],
    summary: 'Konfliktusok, egészségügyi vagy egyéb rendkívüli helyzetek rögzítésére szolgáló modul.',
    steps: [
      'Rögzítsen egy esetet kategóriával (pl. konfliktus, egészségügyi), súlyossággal és rövid leírással.',
      'Mentéskor a jogosult, bejelentkezett felhasználók (pl. műveleti vezető) élő, WebSocketes értesítést kapnak — nem kell frissíteniük az oldalt.',
      'A megoldott eset megoldottként zárható le, a megoldás időpontjával és a rögzítő nevével, így később visszakereshető.',
    ],
  },
  {
    id: 'visszatelepites',
    title: '9. Visszatelepítés',
    roles: ['Műveleti vezető'],
    summary: 'A veszélyhelyzet elmúltával a hazatérés településenkénti engedélyezésének és nyomon követésének felülete.',
    steps: [
      'Rögzítse településenként a visszatelepítés státuszát: Engedélyezett / Feltételes / Nem engedélyezett, opcionális megjegyzéssel.',
      'A lakosok (vagy a helyszíni regisztrátor) megerősíthetik a hazatérést — a rendszer élőben mutatja, hány fő tért haza az adott településről.',
    ],
  },
  {
    id: 'naplo',
    title: '10. Műveleti napló és jelentés',
    roles: ['Auditor', 'Rendszergazda'],
    summary: 'Utólagos ellenőrzésre és elszámolásra szolgáló eszközök.',
    steps: [
      'A Műveleti naplóban visszakereshető, ki mikor mit módosított (státuszváltás, pótlólagos QR-kód kiadása, törlés stb.).',
      'Auditor szerepkörben a személyes adatok (telefonszám, cím) maszkolva jelennek meg — csak a folyamat auditálásához szükséges információ látszik.',
      'Az esemény dashboardjáról CSV-ben exportálható az összesítő jelentés (regisztráltak, családok, állapot-eloszlás, kihasználtság).',
    ],
    link: { to: '/naplo', label: 'Műveleti napló megnyitása' },
  },
  {
    id: 'felhasznalok',
    title: '11. Felhasználók kezelése',
    roles: ['Rendszergazda'],
    summary: 'A rendszerben dolgozó ügyintézők fiókjainak és szerepköreinek központi kezelése.',
    steps: [
      'Az „Új felhasználó” gombbal hozzon létre fiókot névvel, e-mail címmel, jelszóval és szerepkörrel (rendszergazda, vezető, regisztrátor, befogadóhelyi kezelő, auditor).',
      'Meglévő felhasználónál a szerkesztés ikonnal módosíthatók az adatok, a szerepkör és a profilkép.',
      '„Befogadóhelyi kezelő” szerepkör esetén a felhasználó hozzárendelhető egy konkrét befogadóhelyhez.',
      'Kereséssel név vagy e-mail alapján szűrhető, az oszlopfejlécekre kattintva rendezhető a lista.',
    ],
    link: { to: '/felhasznalok', label: 'Felhasználók kezelése' },
  },
  {
    id: 'telepulesek',
    title: '12. Települések (törzsadat)',
    roles: ['Rendszergazda', 'Műveleti vezető'],
    summary: 'Az esemény- és személyregisztrációkban felhasznált települések központi nyilvántartása.',
    steps: [
      'Az „Új település” gombbal vegyen fel nevet, megyét, irányítószámot, és opcionálisan koordinátákat (a térképre kattintva vagy a jelölő húzásával) — ez jeleníti meg a települést a térképes nézeteken.',
      'Meglévő tétel a ceruza ikonnal szerkeszthető.',
      'Törölni (csak rendszergazdaként) a kuka ikonnal lehet, de csak akkor sikeres, ha a településhez már nem tartozik személy vagy befogadóhely.',
    ],
    link: { to: '/telepulesek', label: 'Települések kezelése' },
  },
  {
    id: 'jarmuvek',
    title: '13. Járműflotta (törzsadat)',
    roles: ['Rendszergazda', 'Műveleti vezető'],
    summary: 'A szállítójárművek eseményfüggetlen, központi nyilvántartása — ezt kell megkülönböztetni az esemény-szintű „Szállítás” nézettől, ahol egy konkrét kitelepítés alatti utaslistát és pozíciót kezelik.',
    steps: [
      'Egy járművet egyszer kell felvenni (rendszám, megnevezés, típus, kapacitás, sofőr), utána bármely aktív eseményhez hozzárendelhető szállítóeszközként.',
      'A lista státuszjelzéssel mutatja, hogy egy jármű szabad-e, vagy éppen egy eseményhez van rendelve — a chip-re kattintva a kapcsolódó esemény szállítás nézete nyílik meg.',
      'Foglalt jármű nem törölhető, és másik eseményhez sem rendelhető, amíg fel nem szabadul.',
    ],
    link: { to: '/jarmuvek', label: 'Járműflotta kezelése' },
  },
  {
    id: 'befogadohelyek-torzs',
    title: '14. Befogadóhelyek (törzsadat)',
    roles: ['Rendszergazda', 'Műveleti vezető'],
    summary: 'A befogadóhelyek eseményfüggetlen alapadatait kezelő oldal — ez különbözik a korábban bemutatott, esemény-szintű befogadóhely-nézettől, ahol a tényleges kapacitáskiosztás és bejelentkeztetés zajlik.',
    steps: [
      'Az „Új befogadóhely” gombbal adja meg a nevet, települést, címet, teljes és akadálymentes kapacitást, státuszt (tervezett/aktív/betelt/inaktív) és elérhetőséget.',
      'Rögzítse a kínált szolgáltatásokat (egészségügyi ellátás, ivóvíz, étkeztetés, higiénia, gyermekellátás, lelki segítségnyújtás), valamint a házirendet és közegészségügyi megjegyzéseket.',
      'A törlés (csak rendszergazdaként) csak akkor sikeres, ha a befogadóhely jelenleg nincs eseményhez rendelve.',
    ],
    link: { to: '/befogadohelyek', label: 'Befogadóhelyek törzsadata' },
  },
  {
    id: 'szemely-adatlap',
    title: '15. Személy adatlap',
    summary: 'Egy adott regisztrált személy teljes profilja és a hozzá kapcsolódó ügyintézői műveletek.',
    steps: [
      'Szerkesztheti a személy alapadatait, megtekintheti státusztörténetét és korábbi kitelepítéseit, illetve okmányfényképet rögzíthet.',
      'QR-kódot generálhat/újragenerálhat, a kiosztás módját (digitális, kártya, karszalag, papír) rögzítheti, és nyomtatható azonosító kártyát készíthet.',
      'Módosíthatja a regisztrációs státuszt (pl. megérkezett a gyülekezőpontra, szállítás alatt, megérkezett a befogadóhelyre), rögzítheti az ideiglenes eltávozást/visszaérkezést és az ágy/szoba azonosítót, illetve másik befogadóhelyre helyezheti át a személyt.',
      'Ellátási eseményeket (étkezés, segélycsomag, orvosi ellátás, tisztálkodás) is rögzíthet a személyhez.',
    ],
  },
  {
    id: 'csalad-adatlap',
    title: '16. Család adatlap',
    summary: 'Egy család tagjainak áttekinthető listája, státuszukkal és befogadóhelyükkel együtt.',
    steps: [
      'Egy pillantásra látszik, hány fős a család, és ki a kapcsolattartó (csillag ikon).',
      'Ha a tagok jelenleg különböző befogadóhelyeken vannak, a rendszer figyelmezteti a szétszakadt családra.',
      'Bármelyik családtag kártyájára kattintva közvetlenül a személy adatlapjára navigálhat.',
    ],
  },
  {
    id: 'onkiszolgalo-profil',
    title: '17. Önkiszolgáló profil (lakosság)',
    summary: 'A saját QR-kódjukhoz tartozó egyedi linken keresztül, bejelentkezés nélkül elérhető profiloldal az érintett lakosok számára.',
    steps: [
      'A QR-kódhoz tartozó egyedi linken frissíthető az ideiglenes cím, telefonszám és e-mail cím, illetve jelezhető a központi szállítás vagy elszállásolás igénye, valamint a speciális igények.',
      'Saját járművel utazó a „Megérkeztem” gombbal regisztrálhatja a megérkezését.',
      'Befogadóhelyen tartózkodó (vagy onnan már távozott) személy — ha a hatóság engedélyezte a településére a visszatelepítést — megerősítheti a hazatérését.',
    ],
  },
  {
    id: 'ertesitesek',
    title: '18. Értesítési harang',
    summary: 'Az alkalmazás minden nézetében megjelenő állandó UI-elem, amely az élő incidens- és kapacitásriasztásokat gyűjti egy legördülő listába.',
    steps: [
      'Kattintson a fejlécben lévő harang ikonra a legutóbbi (legfeljebb 50, csak a munkamenet alatt megőrzött) értesítések megtekintéséhez.',
      'Egy értesítésre kattintva az olvasottnak jelölődik, és — ha van hozzá kapcsolódó link — átirányít a kapcsolódó oldalra.',
      'A „Mind olvasott” gombbal egyszerre az összes értesítés olvasottá tehető. Ez csak rövid távú előzmény, nem hivatalos napló — a hivatalos napló a Műveleti napló menüpontban érhető el.',
    ],
  },
  {
    id: 'beallitasok',
    title: '19. Saját fiók és beállítások',
    summary: 'Profil, biztonság és megjelenítési beállítások kezelése.',
    steps: [
      'A Beállítások oldalon módosítható a név, e-mail cím, jelszó és profilkép.',
      'A kétfaktoros hitelesítés (e-mailben kiküldött kód) alapértelmezetten bekapcsolt biztonsági funkció — csak indokolt esetben (pl. fejlesztés) kapcsolja ki.',
      'A betűméret és a hangjelzéses riasztás is itt állítható, böngészőnként megőrizve.',
    ],
    link: { to: '/beallitasok', label: 'Beállítások megnyitása' },
  },
];

export function HelpGuidePage() {
  const [expanded, setExpanded] = useState<string | false>(sections[0].id);

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <HelpOutlineIcon color="primary" fontSize="large" />
        <Typography variant="h4" fontWeight={700}>Szoftver használata</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 760 }}>
        Ez az útmutató lépésről lépésre bemutatja a rendszer fő funkcióit, nagyjából abban a
        sorrendben, ahogyan egy valós kitelepítés során felmerülnek — az esemény
        létrehozásától a lezárásig és az utólagos elszámolásig. Kattintson egy szakaszra a
        részletekért.
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 } }}>
        {sections.map((section) => (
          <Accordion
            key={section.id}
            expanded={expanded === section.id}
            onChange={(_, isExpanded) => setExpanded(isExpanded ? section.id : false)}
            disableGutters
            elevation={0}
            sx={{ '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ width: '100%', pr: 1 }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
                  {section.title}
                </Typography>
                {section.roles && (
                  <Stack direction="row" spacing={0.5}>
                    {section.roles.map((role) => (
                      <Chip key={role} label={role} size="small" variant="outlined" />
                    ))}
                  </Stack>
                )}
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {section.summary}
              </Typography>
              <List dense disablePadding sx={{ listStyleType: 'decimal', pl: 3 }}>
                {section.steps.map((step, i) => (
                  <ListItem key={i} disableGutters sx={{ display: 'list-item', pl: 0.5, py: 0.25 }}>
                    <ListItemText primary={step} />
                  </ListItem>
                ))}
              </List>
              {section.link && (
                <Link component={RouterLink} to={section.link.to} underline="hover" variant="body2" sx={{ display: 'inline-block', mt: 1 }}>
                  {section.link.label} →
                </Link>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>
    </Box>
  );
}
