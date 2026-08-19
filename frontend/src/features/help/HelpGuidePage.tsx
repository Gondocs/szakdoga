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
  ListItemIcon,
  Chip,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';

interface GuideSection {
  id: string;
  title: string;
  roles?: string[];
  summary: string;
  when?: string;
  steps: string[];
  tips?: string[];
  link?: { to: string; label: string };
}

const sections: GuideSection[] = [
  {
    id: 'esemenyek',
    title: '1. Esemény létrehozása és kezelése',
    roles: ['Rendszergazda', 'Műveleti vezető'],
    summary: 'Minden munka egy „eseményhez” (pl. egy konkrét folyó menti kitelepítéshez, egy ipari balesethez) kapcsolódik. Egyetlen rendszerben egyszerre több esemény is futhat, teljesen elkülönített adatokkal — ez az abszolút első lépés bármilyen munka megkezdése előtt.',
    when: 'Akkor hozzon létre új eseményt, amikor egy ténylegesen új, önálló veszélyhelyzet kezelése indul. Ne használjon egy régi, korábbi esemény alatt tovább dolgozni — ha egy már lezárt vagy másik helyszínen zajló kitelepítésről van szó, mindig új eseményt nyisson, különben a statisztikák, kapacitások és névsorok összekeverednek a régi adatokkal.',
    steps: [
      'Nyissa meg az Események listát, és kattintson az „Új esemény” gombra.',
      'Adjon meg egy egyedi, rövid kódot (pl. „ARVIZ-2026-08”) és egy leíró nevet — a kód később a QR-kódokban és exportokban is megjelenik, ezért érdemes dátumot/helyszínt is belefoglalni.',
      'Válassza ki a típust (pl. árvíz, ipari baleset, egyéb) — ez később a jelentésekben és statisztikákban szűrési szempontként szolgál.',
      'Az esemény szerkesztésekor rendeljen hozzá egy vagy több már felvett befogadóhelyet (lásd 14. pont), mindegyikhez saját, az adott eseményre érvényes kapacitás-korláttal — ugyanaz a befogadóhely fizikai kapacitása eseményenként eltérően is korlátozható (pl. ha csak a fele van megnyitva).',
      'Amíg az esemény „Tervezet” státuszban van, a regisztrátorok és más ügyintézők még nem tudnak vele dolgozni — ez szándékos, hogy legyen idő az előkészítésre (befogadóhelyek hozzárendelése, felhasználók szerepkörének ellenőrzése) anélkül, hogy valaki idő előtt regisztrációt kezdene.',
      'Amikor minden elő van készítve, állítsa az esemény státuszát „Aktívra” — ettől kezdve érhető el mindenki számára, és ekkor válik élessé az önkiszolgáló előregisztrációs link is.',
      'A veszélyhelyzet elmúltával, a visszatelepítés befejeztével zárja le az eseményt („Lezárt” státusz) — ez nem törli az adatokat, csak írásvédetté teszi őket; a jogszabályi megőrzési idő lejárta után a rendszer automatikusan törli a hozzá tartozó személyes adatokat.',
    ],
    tips: [
      'Egy esemény lezárása után a hozzá tartozó adatok már nem módosíthatók — ha még folyamatban lévő ügyintézés van (pl. családegyesítés), ne zárja le korán.',
      'A „Tervezet” állapot nem hiba, ha frissen létrehozott eseményt lát a listában inaktívként — ez a szándékos előkészítő fázis, aktiválni kell.',
    ],
    link: { to: '/esemenyek', label: 'Események listája' },
  },
  {
    id: 'dashboard',
    title: '2. Esemény dashboard (áttekintés)',
    summary: 'Egy adott esemény állapotát élőben (WebSocketen, oldalfrissítés nélkül) mutató vezérlőpult — ez legyen a kiindulópont minden munkanapon, és érdemes ezt nyitva tartani a helyszíni irányítás alatt.',
    when: 'Az esemény aktiválása után ez az oldal segít eldönteni, mi a következő teendő — innen navigál tovább a többi menüpontra, ahelyett hogy találgatná, melyik almenüt kellene megnyitnia.',
    steps: [
      'Regisztráltak, családok, megérkezettek és hiányzók száma egy pillantásra — a „Hiányzók” kártyára kattintva rögtön a szűrt névsor nyílik meg, a „Központi szállítást/elszállásolást igénylők” kártyák szintén kattinthatók és szűrt listára navigálnak.',
      'Befogadóhelyi kapacitás- és kockázat-táblázat: telítettség %-ban és kockázati szint (Alacsony/Közepes/Magas) szerint, hogy időben irányítható legyen az elosztás, mielőtt egy befogadóhely valóban betelne.',
      'Napi készletigény-előrejelzés (étkezés, speciális diéta, gyógyszerre szorulók) — kattintható mutatók, amelyek a pontos névsort is megnyitják, így nem kell külön kigyűjteni, kinek mire van szüksége.',
      'A „Kezdő lépések” kártya (amíg egy esemény még üres vagy majdnem üres) végigvezet a legfontosabb első teendőkön: befogadóhely hozzárendelése, első regisztráció felvétele, önkiszolgáló link megosztása, gyülekezőpontok felvétele a térképen. Ez a kártya eltűnik, ha bezárja vagy ha az esemény már elég adatot tartalmaz — ha újra elő szeretné venni, ez a súgóoldal ugyanazokat a lépéseket tartalmazza.',
    ],
  },
  {
    id: 'regisztracio',
    title: '3. Helyszíni regisztráció és önkiszolgáló előregisztráció',
    roles: ['Regisztrátor'],
    summary: 'A lakosság kétféleképpen kerülhet be a rendszerbe: helyszíni regisztrációval (egy ügyintéző rögzíti az adatokat), vagy önkiszolgáló módon, saját maga által, otthonról, bejelentkezés nélkül.',
    when: 'Ez a lépés az esemény aktiválása és a befogadóhelyek/gyülekezőpontok előkészítése UTÁN következik — regisztrálni technikailag korábban is lehetne, de gyakorlati szempontból célszerű előbb legalább egy befogadóhelyet és (ha releváns) gyülekezőpontokat felvenni, hogy a regisztrátor tudja, hova irányítsa az embereket.',
    steps: [
      'Helyszíni felvételhez használja a Regisztrációs varázslót: személyes adatok, cím (kereshető településlistából), család hozzárendelése (ha többen érkeznek együtt), egyedi igények rögzítése (mozgáskorlátozottság, diéta, gyógyszer stb.).',
      'A varázslóban jelölje be, ha a személy kér központi szállítást és/vagy központi elszállásolást — ez határozza meg, hogy megjelenik-e a szállítási/befogadóhelyi kapacitástervezésben és a dashboard kimutatásaiban.',
      'A regisztráció végén a rendszer QR-kódot állít elő — ezt a személy a telefonján tárolhatja, vagy ki lehet nyomtatni (nyomtatható azonosító kártya funkció); ezt a kódot fogják beolvasni a gyülekezőponton, a szállítóeszközön és a befogadóhelyen.',
      'Otthoni, bejelentkezés nélküli regisztrációhoz ossza meg az esemény dashboardján található önkiszolgáló linket (pl. Facebook-oldalon, önkormányzati hirdetményben, SMS-ben) — ez a link csak akkor működik, ha az esemény „Aktív” státuszban van.',
      'Az önkiszolgálón keresztül regisztrált személy a regisztráció után kapott saját profillinkjén (publikus azonosító alapján, bejelentkezés nélkül) később bármikor módosíthatja/megerősítheti elérhetőségi adatait, jelezheti a szállítási/elszállásolási igényét, illetve — ha a hatóság engedélyezte — megerősítheti a hazatérését.',
    ],
    tips: [
      'Ha valaki panaszkodik, hogy nem találja az önkiszolgáló linket: az csak akkor él, ha az esemény már „Aktív”, és a link eseményenként eltérő (az esemény kódját tartalmazza) — mindig az adott esemény dashboardjáról másolja ki.',
      'A helyszíni regisztrációnál felvett „saját jármű” jelölés (aki nem kér központi szállítást) elkülönül a „központi szállítást igényel” jelölőtől — a kettő ellentétes jelentésű, ne keverje össze.',
    ],
  },
  {
    id: 'erkeztetes',
    title: '4. QR érkeztetés és befogadóhelyek',
    roles: ['Regisztrátor', 'Befogadóhelyi kezelő'],
    summary: 'A QR-kód a teljes folyamat gerince: felszálláskor, leszálláskor és a befogadóhelyre érkezéskor is ezt olvassák be — ez köti össze a regisztrációt a fizikai jelenléttel.',
    when: 'Azután releváns, hogy valaki már regisztrálva van (van QR-kódja) és fizikailag megérkezik egy adott ponthoz (gyülekezőpont, jármű, befogadóhely).',
    steps: [
      'A QR érkeztetés felületen egy kód beolvasása (kamerával vagy kézi beírással) azonnal megjeleníti a személy adatait, beleértve az egyedi igényeket is (pl. mozgáskorlátozottság figyelmeztető ikonnal, hogy a fogadó személyzet azonnal lássa).',
      'A Befogadóhelyek oldalon az érkező személyt konkrét ágyhoz/szobához/helyhez lehet rendelni — ez nem automatikus, az ügyintézőnek kell kiválasztania egy szabad helyet.',
      'Ha egy család tagjai a hozzárendelés során különböző befogadóhelyekre kerülnének, a rendszer automatikusan figyelmeztet erre az érkeztetéskor, hogy időben el lehessen kerülni a szétszakítást (ha van rá kapacitás).',
      'A befogadóhely aktuális névsora bármikor megnyitható és nyomtatható (böngésző nyomtatás/PDF) — hasznos műszakváltáskor vagy hatósági ellenőrzéskor.',
    ],
    tips: [
      'Ha egy befogadóhely nem jelenik meg az érkeztetésnél, valószínűleg még nincs hozzárendelve az adott eseményhez — ezt az esemény szerkesztésénél (1. pont) kell megtenni, nem itt.',
    ],
    link: { to: '/befogadohelyek', label: 'Befogadóhelyek kezelése' },
  },
  {
    id: 'szallitas',
    title: '5. Szállítás nyomon követése',
    roles: ['Kísérő', 'Regisztrátor'],
    summary: 'Központi szállítóeszközök (pl. buszok) útvonalának és utaslistájának kezelése — csak azoknak a személyeknek releváns, akik nem saját járművel utaznak.',
    when: 'Csak akkor van rá szükség, ha ténylegesen szerveznek központi szállítást (busz, kisbusz). Ha mindenki saját járművel közlekedik, ez a modul üresen maradhat — nem kötelező lépés minden eseménynél.',
    steps: [
      'Vegyen fel egy szállítóeszközt megnevezéssel, kapacitással, kísérő személlyel, induló és cél befogadóhellyel — a jármű maga a Járműflotta törzsadatból (13. pont) választható, ha korábban már felvették.',
      'A gyülekezőponton QR-kóddal rögzítse a felszálló utasokat — a rendszer élőben mutatja a fedélzeten lévők számát (pl. „26 / 50 fő”), így menet közben is látszik, mennyi hely maradt.',
      'Útközben a „Pozíció szimulálása” funkcióval frissíthető a jármű helyzete (mivel a rendszerben nincs valós GPS-integráció, ez egy demonstrációs funkció) — ez a Térkép nézeten élőben, frissítés nélkül követhető.',
      'Érkezéskor a „Leszállás rögzítése” gombbal jelezze az utasok leszállását, ezután kezdődhet a befogadóhelyi érkeztetés (4. pont) a célállomáson.',
    ],
  },
  {
    id: 'terkep',
    title: '6. Térkép és gyülekezőpontok',
    summary: 'Térképes áttekintés az esemény szereplőiről és helyszíneiről, valamint a gyülekezőpontok (találkozási helyszínek) kezelésének felülete.',
    when: 'A gyülekezőpontokat érdemes még az aktív regisztráció megkezdése ELŐTT felvenni, ha a terv az, hogy a lakosság egy kijelölt ponton gyűlik össze a központi szállítás előtt — enélkül a regisztrátorok és a lakosság sem tudja, hova kell menni.',
    steps: [
      'A térképen élőben követhetők a mozgó szállítóeszközök, valamint megjelennek a befogadóhelyek és gyülekezőpontok egy közös, színkódolt nézeten.',
      'Gyülekezőpontokat (pl. találkozási helyszínek a lakosság számára, ahonnan a központi szállítás indul) az esemény alatt bármikor felvehet vagy módosíthat: adjon nevet, koordinátát (térképre kattintva) és opcionálisan leírást/elérhetőséget.',
      'A gyülekezőpontok listája és a térkép nem csak a rendszert kezelő ügyintézőknek hasznos — érdemes ezt a helyszíni tájékoztató anyagokban (hirdetmény, közösségi média poszt) is feltüntetni, hogy a lakosság tudja, hova menjen.',
    ],
    tips: [
      'Ha az emberek nem tudják, hova kell menniük gyülekezéshez: ellenőrizze, hogy fel van-e véve legalább egy gyülekezőpont ehhez az eseményhez, és hogy ez az információ el lett-e juttatva hozzájuk a rendszeren kívül is (a szoftver nem küld automatikus SMS-t/értesítést a teljes lakosságnak).',
    ],
  },
  {
    id: 'csaladok',
    title: '7. Családok és családegyesítés',
    roles: ['Műveleti vezető'],
    summary: 'A rendszer családi kötelékként kezeli az együtt regisztrált személyeket, és jelzi, ha egy család szétszakad (pl. mert két befogadóhelyre kerültek kapacitáshiány miatt).',
    steps: [
      'A Családok listán áttekinthető, mely családok vannak jelenleg együtt, és melyek vannak szétszórva több befogadóhelyen.',
      'Ha egy család tagjai eltérő befogadóhelyre kerülnek, a Családegyesítési munkalistán megjelenik az eset egy térképpel, hogy hol tartózkodnak jelenleg a tagok — ez segít eldönteni, érdemes-e és lehetséges-e áthelyezéssel egyesíteni őket.',
      'Az esethez ügyintézési bejegyzés (pl. „átszállítás szervezés alatt a nagypapa gyógyszeres kezelése miatt priorizálva”) rögzíthető, majd — miután megoldották — megoldottként lezárható, dátummal és a rögzítő nevével.',
    ],
  },
  {
    id: 'incidensek',
    title: '8. Rendkívüli események (incidensek)',
    roles: ['Befogadóhelyi kezelő', 'Műveleti vezető'],
    summary: 'Konfliktusok, egészségügyi vagy egyéb rendkívüli helyzetek rögzítésére szolgáló modul, amely a helyszíni személyzet és a vezetés közötti gyors kommunikációt szolgálja.',
    steps: [
      'Rögzítsen egy esetet kategóriával (pl. konfliktus, egészségügyi, egyéb), súlyossággal (alacsony/közepes/magas) és rövid leírással.',
      'Mentéskor a jogosult, bejelentkezett felhasználók (pl. műveleti vezető, aki épp másik oldalon dolgozik) élő, WebSocketes toast-értesítést kapnak — nem kell frissíteniük az oldalt vagy külön ellenőrizniük, hogy történt-e valami.',
      'A megoldott eset megoldottként zárható le, a megoldás időpontjával és a rögzítő nevével, így később, akár egy utólagos hatósági vizsgálatnál is visszakereshető, mi történt és hogyan kezelték.',
    ],
  },
  {
    id: 'visszatelepites',
    title: '9. Visszatelepítés',
    roles: ['Műveleti vezető'],
    summary: 'A veszélyhelyzet elmúltával a hazatérés településenkénti engedélyezésének és nyomon követésének felülete — ez a folyamat utolsó, lezáró szakasza az esemény lezárása előtt.',
    when: 'Csak akkor releváns, amikor a veszélyhelyzet elmúlt, és a hatóság engedélyezi (akár csak részlegesen, településenként) a hazatérést. Az esemény lezárása előtt érdemes ezt a szakaszt végigvinni, különben a rendszer nem fogja tudni pontosan nyilvántartani, ki tért haza és ki nem.',
    steps: [
      'Rögzítse településenként a visszatelepítés státuszát: Engedélyezett / Feltételes / Nem engedélyezett, opcionális megjegyzéssel (pl. „csak a X utcától keletre engedélyezett”).',
      'A lakosok (az önkiszolgáló profiljukon keresztül) vagy a helyszíni regisztrátor megerősíthetik a hazatérést — a rendszer élőben mutatja, hány fő tért haza az adott településről, ami segít nyomon követni, mikor ürül ki egy befogadóhely.',
    ],
  },
  {
    id: 'naplo',
    title: '10. Műveleti napló és jelentés',
    roles: ['Auditor', 'Rendszergazda'],
    summary: 'Utólagos ellenőrzésre és elszámolásra szolgáló eszközök — ez nem napi munkavégzésre való felület, hanem visszakeresésre és jelentéskészítésre.',
    steps: [
      'A Műveleti naplóban visszakereshető, ki mikor mit módosított (státuszváltás, pótlólagos QR-kód kiadása, törlés, áthelyezés, bejelentkezés/kijelentkezés, felhasználó- és szerepkör-módosítás stb.) — szűrhető felhasználó, esemény, entitástípus, művelet és időintervallum szerint.',
      'A napló tetején egy élő „aktivitás” csík (WebSocket) mutatja a legutóbbi bejegyzéseket admin/vezető/auditor szerepkörnek, frissítés nélkül — ez maga nem tartalmaz érzékeny adatot, csak a teljes naplóban, kattintva látszik a részletes előtte/utána állapot.',
      'Auditor szerepkörben a személyes adatok (telefonszám, cím) maszkolva jelennek meg — csak a folyamat auditálásához szükséges információ látszik, a maszkolás a naplóban és a személylistákon is érvényesül.',
      'Az esemény dashboardjáról CSV-ben exportálható az összesítő jelentés (regisztráltak, családok, állapot-eloszlás, kihasználtság, szállítási/elszállásolási igények), magyar nyelvű oszlopcímekkel.',
    ],
    link: { to: '/naplo', label: 'Műveleti napló megnyitása' },
  },
  {
    id: 'felhasznalok',
    title: '11. Felhasználók kezelése',
    roles: ['Rendszergazda'],
    summary: 'A rendszerben dolgozó ügyintézők fiókjainak és szerepköreinek központi kezelése — ez eseményfüggetlen, egyszeri beállítás, nem esemény-specifikus lépés.',
    when: 'Ezt jellemzően nem eseményenként kell elvégezni, hanem egyszer, amikor egy új kolléga csatlakozik a szervezethez — a felhasználók minden eseményhez hozzáférnek a szerepkörüknek megfelelően, nem kell őket eseményenként újra felvenni.',
    steps: [
      'Az „Új felhasználó” gombbal hozzon létre fiókot névvel, e-mail címmel, jelszóval és szerepkörrel (rendszergazda, vezető, regisztrátor, befogadóhelyi kezelő, auditor) — a szerepkör határozza meg, mely menüpontokat és funkciókat láthatja/használhatja.',
      'Meglévő felhasználónál a szerkesztés ikonnal módosíthatók az adatok, a szerepkör és a profilkép.',
      '„Befogadóhelyi kezelő” szerepkör esetén a felhasználó hozzárendelhető egy konkrét befogadóhelyhez — ekkor csak az adott befogadóhely adatait látja/kezelheti, nem az összes eseményt.',
      'Kereséssel név vagy e-mail alapján szűrhető, az oszlopfejlécekre kattintva rendezhető a lista.',
    ],
    tips: [
      'Ha egy kolléga nem lát egy menüpontot, először ellenőrizze a szerepkörét itt — a legtöbb „hiányzó menü” panasz szerepkör-korlátozásból ered, nem hibából.',
    ],
    link: { to: '/felhasznalok', label: 'Felhasználók kezelése' },
  },
  {
    id: 'telepulesek',
    title: '12. Települések (törzsadat)',
    roles: ['Rendszergazda', 'Műveleti vezető'],
    summary: 'Az esemény- és személyregisztrációkban felhasznált települések központi nyilvántartása — eseményfüggetlen alapadat, mint egy címlista.',
    when: 'Ezt is jellemzően csak egyszer, előre kell feltölteni (esetleg alkalmanként bővíteni), nem eseményenként — a regisztrációnál és a térképes nézeteken minden eseményben ugyanazokból a településekből lehet választani.',
    steps: [
      'Az „Új település” gombbal vegyen fel nevet, megyét, irányítószámot, és opcionálisan koordinátákat (a térképre kattintva vagy a jelölő húzásával) — koordináták nélkül a település nem fog megjelenni a térképes nézeteken (pl. a szállítást igénylők településenkénti hőtérképén).',
      'Meglévő tétel a ceruza ikonnal szerkeszthető.',
      'Törölni (csak rendszergazdaként) a kuka ikonnal lehet, de csak akkor sikeres, ha a településhez már nem tartozik személy vagy befogadóhely — ez szándékos védelem az adatvesztés ellen.',
    ],
    link: { to: '/telepulesek', label: 'Települések kezelése' },
  },
  {
    id: 'jarmuvek',
    title: '13. Járműflotta (törzsadat)',
    roles: ['Rendszergazda', 'Műveleti vezető'],
    summary: 'A szállítójárművek eseményfüggetlen, központi nyilvántartása — ezt kell megkülönböztetni az esemény-szintű „Szállítás” nézettől (5. pont), ahol egy konkrét kitelepítés alatti utaslistát és pozíciót kezelik.',
    when: 'Egy járművet elég egyszer felvenni; utána bármelyik aktív eseményhez hozzárendelhető, amikor éppen szükség van rá. Ha egy jármű már foglalt egy eseményben, egy másik esemény szállítás nézetében nem fog megjelenni választható lehetőségként.',
    steps: [
      'Egy járművet egyszer kell felvenni (rendszám, megnevezés, típus, kapacitás, sofőr), utána bármely aktív eseményhez hozzárendelhető szállítóeszközként (5. pont).',
      'A lista státuszjelzéssel mutatja, hogy egy jármű szabad-e, vagy éppen egy eseményhez van rendelve — a chip-re kattintva a kapcsolódó esemény szállítás nézete nyílik meg.',
      'Foglalt jármű nem törölhető, és másik eseményhez sem rendelhető, amíg fel nem szabadul (pl. az adott esemény lezárásával vagy a jármű leválasztásával).',
    ],
    link: { to: '/jarmuvek', label: 'Járműflotta kezelése' },
  },
  {
    id: 'befogadohelyek-torzs',
    title: '14. Befogadóhelyek (törzsadat)',
    roles: ['Rendszergazda', 'Műveleti vezető'],
    summary: 'A befogadóhelyek eseményfüggetlen alapadatait kezelő oldal — ez különbözik a 4. pontban bemutatott, esemény-szintű befogadóhely-nézettől, ahol a tényleges kapacitáskiosztás és bejelentkeztetés zajlik.',
    when: 'Egy befogadóhelyet (pl. egy sportcsarnokot) elég egyszer felvenni a törzsadatba; utána eseményenként (1. pont) rendelhető hozzá egy adott kitelepítéshez, saját, az adott helyzetre érvényes kapacitáskorláttal.',
    steps: [
      'Az „Új befogadóhely” gombbal adja meg a nevet, települést, címet, teljes és akadálymentes kapacitást, státuszt (tervezett/aktív/betelt/inaktív) és elérhetőséget.',
      'Rögzítse a kínált szolgáltatásokat (egészségügyi ellátás, ivóvíz, étkeztetés, higiénia, gyermekellátás, lelki segítségnyújtás), valamint a házirendet és közegészségügyi megjegyzéseket — ezek az információk a befogadóhely kiválasztásakor segítik az ügyintézőt.',
      'A törlés (csak rendszergazdaként) csak akkor sikeres, ha a befogadóhely jelenleg nincs eseményhez rendelve.',
    ],
    link: { to: '/befogadohelyek', label: 'Befogadóhelyek törzsadata' },
  },
  {
    id: 'szemely-adatlap',
    title: '15. Személy adatlap',
    summary: 'Egy adott regisztrált személy teljes profilja és a hozzá kapcsolódó ügyintézői műveletek — innen érhető el gyakorlatilag minden, ami az adott emberrel kapcsolatban történik.',
    steps: [
      'Szerkesztheti a személy alapadatait, megtekintheti státusztörténetét és korábbi kitelepítéseit (ha több eseményben is szerepelt), illetve okmányfényképet rögzíthet.',
      'QR-kódot generálhat/újragenerálhat (pl. elveszett kártya esetén), a kiosztás módját (digitális, kártya, karszalag, papír) rögzítheti, és nyomtatható azonosító kártyát készíthet.',
      'Módosíthatja a regisztrációs státuszt (pl. megérkezett a gyülekezőpontra, szállítás alatt, megérkezett a befogadóhelyre, elhagyta a befogadóhelyet, hazatért, eltűnt, törölt), rögzítheti az ideiglenes eltávozást/visszaérkezést és az ágy/szoba azonosítót, illetve másik befogadóhelyre helyezheti át a személyt.',
      'Ellátási eseményeket (étkezés, segélycsomag, orvosi ellátás, tisztálkodás) is rögzíthet a személyhez, valamint itt látszik, hogy kér-e központi szállítást és/vagy elszállásolást.',
    ],
  },
  {
    id: 'csalad-adatlap',
    title: '16. Család adatlap',
    summary: 'Egy család tagjainak áttekinthető listája, státuszukkal és befogadóhelyükkel együtt.',
    steps: [
      'Egy pillantásra látszik, hány fős a család, és ki a kapcsolattartó (csillag ikon).',
      'Ha a tagok jelenleg különböző befogadóhelyeken vannak, a rendszer figyelmezteti a szétszakadt családra — ez ugyanaz a jelzés, ami a Családegyesítési munkalistán (7. pont) is megjelenik.',
      'Bármelyik családtag kártyájára kattintva közvetlenül a személy adatlapjára (15. pont) navigálhat.',
    ],
  },
  {
    id: 'onkiszolgalo-profil',
    title: '17. Önkiszolgáló profil (lakosság)',
    summary: 'A saját QR-kódjukhoz tartozó egyedi linken keresztül, bejelentkezés nélkül elérhető profiloldal az érintett lakosok számára — ezt nem az ügyintézők, hanem maguk az érintettek használják.',
    steps: [
      'A QR-kódhoz tartozó egyedi linken frissíthető az ideiglenes cím, telefonszám és e-mail cím, illetve jelezhető a központi szállítás vagy elszállásolás igénye, valamint a speciális igények.',
      'Saját járművel utazó a „Megérkeztem” gombbal regisztrálhatja a megérkezését, anélkül hogy valakinek be kellene olvasnia a QR-kódját.',
      'Befogadóhelyen tartózkodó (vagy onnan már távozott) személy — ha a hatóság engedélyezte a településére a visszatelepítést (9. pont) — megerősítheti a hazatérését ugyanerről a felületről.',
    ],
  },
  {
    id: 'ertesitesek',
    title: '18. Értesítési harang',
    summary: 'Az alkalmazás minden nézetében megjelenő állandó UI-elem, amely az élő incidens- és kapacitásriasztásokat gyűjti egy legördülő listába.',
    steps: [
      'Kattintson a fejlécben lévő harang ikonra a legutóbbi (legfeljebb 50, csak a munkamenet alatt megőrzött) értesítések megtekintéséhez.',
      'Egy értesítésre kattintva az olvasottnak jelölődik, és — ha van hozzá kapcsolódó link — átirányít a kapcsolódó oldalra (pl. egy incidens részleteire).',
      'A „Mind olvasott” gombbal egyszerre az összes értesítés olvasottá tehető. Ez csak rövid távú előzmény, nem hivatalos napló — a hivatalos, teljes napló a Műveleti napló menüpontban (10. pont) érhető el.',
    ],
  },
  {
    id: 'beallitasok',
    title: '19. Saját fiók és beállítások',
    summary: 'Profil, biztonság és megjelenítési beállítások kezelése.',
    steps: [
      'A Beállítások oldalon módosítható a név, e-mail cím, jelszó és profilkép.',
      'A kétfaktoros hitelesítés (e-mailben kiküldött kód) alapértelmezetten bekapcsolt biztonsági funkció — csak indokolt esetben (pl. fejlesztés) kapcsolja ki.',
      'A betűméret és a hangjelzéses riasztás is itt állítható, böngészőnként megőrizve — ezek nem szervermenthetőek, tehát más gépen/böngészőben újra be kell állítani.',
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 760 }}>
        Ez az útmutató lépésről lépésre, részletesen bemutatja a rendszer fő funkcióit, nagyjából
        abban a sorrendben, ahogyan egy valós kitelepítés során felmerülnek — az esemény
        létrehozásától a lezárásig és az utólagos elszámolásig. Minden szakaszhoz tartozik egy
        „Mikor van rá szükség” magyarázat is, ami segít eldönteni, mikor és kinek kell az adott
        menüponttal foglalkoznia. Kattintson egy szakaszra a részletekért.
      </Typography>
      <Alert severity="info" sx={{ mb: 3, maxWidth: 760 }}>
        A menüpontok egy része (pl. Felhasználók, Települések, Járműflotta, Befogadóhelyek
        törzsadata — 11–14. pont) <strong>eseményfüggetlen, egyszeri alapadat</strong>, amit nem
        kell minden új kitelepítésnél újra beállítani. A többi menüpont egy adott, aktív esemény
        napi működéséhez tartozik.
      </Alert>

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

              {section.when && (
                <Alert
                  icon={<ScheduleOutlinedIcon fontSize="inherit" />}
                  severity="info"
                  variant="outlined"
                  sx={{ mb: 1.5 }}
                >
                  <strong>Mikor van rá szükség:</strong> {section.when}
                </Alert>
              )}

              <List dense disablePadding sx={{ listStyleType: 'decimal', pl: 3 }}>
                {section.steps.map((step, i) => (
                  <ListItem key={i} disableGutters sx={{ display: 'list-item', pl: 0.5, py: 0.25 }}>
                    <ListItemText primary={step} />
                  </ListItem>
                ))}
              </List>

              {section.tips && section.tips.length > 0 && (
                <List dense disablePadding sx={{ mt: 1.5 }}>
                  {section.tips.map((tip, i) => (
                    <ListItem key={i} disableGutters alignItems="flex-start" sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
                        <LightbulbOutlinedIcon fontSize="small" color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={tip}
                        slotProps={{ primary: { variant: 'body2', color: 'text.secondary' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}

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
