# Demó forgatókönyv – Lakossági Kitelepítés Támogató Rendszer

> Katasztrófavédelmi bemutatóhoz. Cél: megmutatni, mit tud a rendszer, hogyan működik élesben, és kiemelni azokat a részeket, amik **automatikusan**, kattintgatás nélkül történnek (élő WebSocket-frissítések).

---

## 1. Mi ez az alkalmazás egy mondatban?

Webalkalmazás, ami egy tömeges kitelepítés (árvíz, ipari baleset, egyéb veszélyhelyzet) teljes folyamatát digitalizálja: a lakosság regisztrációjától a gyülekezőponton és a szállításon át a befogadóhelyi elhelyezésig, a családegyesítésig és a visszatelepítésig — élő, valós idejű áttekintéssel a helyzetről, és teljes körű naplózással.

A GYMS Vármegyei Katasztrófavédelmi Igazgatóság munkájának támogatására készült, egy Interreg Magyarország–Szlovákia tanulmány funkcióspecifikációja alapján.

**A probléma, amit megold:** papíron/Excelben nem látható valós időben, hány ember hol van, mely befogadóhely telik meg, mely családok szakadtak szét, kik igényelnek speciális ellátást.

---

## 2. Technológia röviden (ha rákérdeznek)

| | |
|---|---|
| Backend | PHP 8.2, Laravel 12, REST API |
| Frontend | React 19 + TypeScript, Vite, MUI |
| Valós idejű frissítés | Laravel Reverb (saját, önhosztolt WebSocket-szerver) + Laravel Echo |
| Térkép | Leaflet + OpenStreetMap (nincs fizetős térkép-API) |
| Autentikáció | Laravel Sanctum + **kötelező kétfaktoros hitelesítés** (e-mail kód) |
| Adatbázis | MySQL (bemutatóhoz), fejlesztéshez SQLite |

Szándékosan nincs benne külső fizetős szolgáltatás (térkép, WebSocket) — mindegyik ingyenes/önhosztolt, ami egy közigazgatási rendszernél fontos szempont.

---

## 3. Szerepkörök (kikkel/kinek szól a rendszer)

| Szerepkör | Mit csinál |
|---|---|
| **Rendszergazda** | Felhasználók, alapadatok, események kezelése |
| **Műveleti vezető** | Dashboard, jelentések, esemény állapota |
| **Regisztrátor** | Helyszíni regisztráció, QR-kód kiadás |
| **Befogadóhelyi kezelő** | QR-beolvasás, érkeztetés — csak a saját befogadóhelyén |
| **Auditor** | Csak olvasás, személyes adatok maszkolva |

Minden jogosultság a **backendben** (Laravel Policy) dől el, nem csak a felületen — ezt érdemes megemlíteni, mert katasztrófavédelmi/hatósági közegben ez pont az, amit ellenőrizni fognak.

---

## 4. A demó előtti technikai előkészület

Három folyamatnak kell futnia egyszerre (érdemes előre elindítani, ne a bemutató alatt):

```bash
# gyökérkönyvtárból, egy paranccsal mind a három:
npm run dev
```
Ez elindítja: a backend PHP szervert, a **Reverb WebSocket-szervert**, és a frontend Vite szervert.

> Ha a Reverb szerver nem fut, az élő frissítések (dashboard, incidens-toast, busz-mozgás, audit-csík) **nem működnek** — a rendszer ilyenkor "visszaesik" statikus, egyszeri betöltésre. Demó előtt mindenképp ellenőrizd, hogy mindhárom folyamat zöld/hibamentes.

### Élő adatgeneráló eszközök (ez a demó "titkos fegyvere")

Két artisan parancs, amivel **anélkül** lehet élő mozgást mutatni a képernyőn, hogy folyamatosan kattintgatni kelljen:

```bash
cd backend

# folyamatos, kis léptékű aktivitás egy eseményhez (érkeztetés, áthelyezés, szállítás-pozíció, incidens)
php artisan demo:simulate-activity              # EVT-2026-001, 4 mp-enként
php artisan demo:simulate-activity EVT-2026-002 --interval=2 --duration=60

# nagy, ~300 fős, teljes forgatókönyv egy vadonatúj eseményhez, önellenőrző riporttal a végén
php artisan demo:full-scenario
```

**Javasolt előkészület a bemutató előtti napon/reggelén:**
1. Futtasd le `php artisan demo:full-scenario`-t — ez létrehoz egy kb. 300 fős, "élettel teli" eseményt (családok, szétszakadt és újraegyesített családok, szállítás, incidens, visszatelepítés-igény), ami a végén **aktív állapotban marad**.
2. A bemutató alatt ezt az eseményt nyisd meg, és eleve legyen "élő" tartalom a dashboardon, listákon, térképen.
3. Live demózáshoz (2. blokk alább) indíts egy második terminálban `demo:simulate-activity`-t ugyanerre az eseményre — ez fogja élőben mozgatni a képernyőt, amíg te magyarázol.

---

## 5. Bemutatandó funkciók — sorrendben javasolt forgatókönyv

### 5.1 Bejelentkezés + kétfaktoros hitelesítés (2FA)
- Jelentkezz be admin/vezető felhasználóval.
- Helyes jelszó után a rendszer **e-mailben 6 jegyű kódot küld** (10 percig érvényes, max. 5 próbálkozás) — ez az **automatikus** rész, amit érdemes kiemelni: minden belépő staffnak kötelező, nem kikapcsolható központilag.
- *Mondanivaló:* ez hatósági rendszernél elvárt biztonsági szint, session-alapú (nincs hosszú élettartamú token a kliensen).

### 5.2 Esemény áttekintés / Dashboard (`attekintes`) — **a demó szíve**
- Nyisd meg az előre elkészített, aktív eseményt.
- Mutasd meg: KPI-kártyák (regisztráltak, családok, megérkezettek, hiányzók száma) — mindegyik **kattintható**, szűrt személylistára navigál.
- Demográfiai bontás, speciális igény szerinti eloszlás diagramokon (Recharts).
- **Befogadóhelyi kapacitás- és kockázat-táblázat.**
- Napi készletigény-előrejelzés (étkezés, takaró, matrac, gyógyszer).
- **Ekkor indítsd el a második terminálban a `demo:simulate-activity` parancsot.** Pár másodpercen belül:
  - a kapacitás-/kockázat-táblázat **magától frissül** — nincs F5, nincs pollozás, **WebSocketen (Laravel Reverb)** érkezik a változás valós időben.
  - ha egy befogadóhely kritikus kockázati szintre lép, vagy új incidens keletkezik → **élő toast-értesítés** jelenik meg a képernyő sarkában.
- *Mondanivaló:* ha most valahol egy másik gépen/telefonon valaki érkeztet egy embert, az itt a képernyőn **azonnal** látszik, minden érintett staffnak egyszerre — ez pont az, ami papíron/Excelben lehetetlen egy éles helyzetben.

### 5.3 Kapcsolat-állapot jelző
- Mutasd meg a fejlécben lévő kis wifi-ikont (`ConnectionStatusIndicator`) — ez a WebSocket-kapcsolat valós állapotát mutatja (csatlakozva/csatlakozik/nincs kapcsolat).
- *Mondanivaló:* ez bizonyítja, hogy a live frissítés **valódi**, nem szimulált a felületen — látszik, ha megszakad a kapcsolat.

### 5.4 QR-kód alapú azonosítás
- Mutass egy személyt, akihez QR-kód tartozik (digitális "kitelepítési igazolvány").
- Ha van kamerás eszköz kéznél: **kiosk mód** — QR-beolvasás, a kamera automatikusan újranyit a következő beolvasáshoz, sikeres beolvasáskor visszajelzés.
- Említsd meg: elveszett kód esetén új adható ki, ami a régit érvényteleníti, és ez **kiemelt naplóbejegyzésként** (`qr_reissue_lost`) kerül rögzítésre.

### 5.5 Regisztráció — kétféle út
- **Helyszíni regisztráció**: staff tölti ki (név, lakcím, speciális igények, állatok, család).
- **Lakossági önkiszolgáló előregisztráció**: nyisd meg a nyilvános linket (`/onkiszolgalo/:eventCode`) **bejelentkezés nélkül** — ezt akár a saját telefonodon is megmutathatod. A lakos maga regisztrál, QR-kódot kap, később saját profilját is szerkesztheti.
- *Mondanivaló:* ez tehermentesíti a helyszíni személyzetet tömeges esemény esetén.

### 5.6 Szállítás + Térkép — élő buszmozgás
- Nyisd meg egyszerre (két fülön) a **Szállítás** és a **Térkép** oldalt.
- Kattints a "Pozíció szimulálása" gombra a Szállítás oldalon (vagy hagyd, hogy a `demo:simulate-activity` csinálja automatikusan).
- **A busz-jelölő mindkét oldalon egyszerre, élőben mozdul** — ugyanaz a WebSocket-esemény frissíti mindkét nézetet.
- Térképen mutasd meg: a regisztrált személyek **nem pontos címükön**, hanem településenként összesítve jelennek meg — adatvédelmi okból.
- *Megjegyzés őszintén:* a GPS-pozíció jelenleg **szimulált**, nincs mögötte valós jármű-GPS — ezt érdemes előre bevállalni, ha rákérdeznek, mint tudatos, koncepció-demonstráló egyszerűsítés.

### 5.7 Családegyesítés
- Mutasd meg a családegyesítési munkalistát: azok a családok, akiknek tagjai jelenleg különböző befogadóhelyeken vannak.
- Kártyás nézet, kattintható tag → átnavigál a személy adatlapjára, opcionális térképnézet, hogy hol vannak most a tagok.
- Említsd meg: érkeztetéskor/áthelyezéskor a rendszer **automatikusan figyelmeztet**, ha ez szétszakítana egy családot.

### 5.8 Rendkívüli események (incidensek)
- Vegyél fel egy új incidenst (panasz/konfliktus/kár) egy befogadóhelyhez kötve, súlyossággal.
- Ha van másik böngészőablak/eszköz nyitva a dashboardon vagy az `EventSubNav`-on: **azonnal megjelenik a toast** ott is — WebSocketen, nem frissítéssel.
- Ha be van kapcsolva a hangjelzés (lásd Beállítások): **két rövid sípoló hang** is lejátszódik.

### 5.9 Visszavonható törlés (Undo delete) — jó kis "wow" momentum
- Menj egy listás nézetbe (pl. Járművek, Szállítások, Befogadóhelyek, Települések, Események).
- Törölj egy elemet: az **azonnal eltűnik** a listából (optimista UI), és megjelenik egy toast "Visszavonás" gombbal.
- Kattints a **Visszavonásra** 6 másodpercen belül → az elem visszakerül, a törlés ténylegesen soha nem történt meg a backendben.
- *Mondanivaló:* hatósági rendszernél fontos a hibatűrés — egy véletlen törlés ne legyen visszafordíthatatlan.

### 5.10 Visszatelepítés
- Mutasd meg a településenkénti visszatelepítési engedélyezési státuszt (nem engedélyezett / feltételes / engedélyezett), feltételekkel és időablakkal.

### 5.11 Naplózás és auditálás — élő aktivitás-csík
- Nyisd meg a **Napló** oldalt (admin/vezető/auditor).
- A lap tetején egy **élő aktivitás-csík** mutatja a legutóbbi bejegyzéseket (ki, mit, mikor) — ez is WebSocketen frissül, amíg a `demo:simulate-activity` fut a háttérben, folyamatosan pörögnek rajta az új bejegyzések.
- A csík maga nem mutat érzékeny adatot — csak a teljes, maszkolt naplóban, kattintva.
- Szűrhető felhasználó, esemény, entitástípus, művelet, időintervallum szerint; CSV export.
- Auditor szerepkörrel bejelentkezve (ha van rá idő) mutasd meg, hogy a személyes adatok **maszkolva** jelennek meg neki.

### 5.12 Értesítési központ (harang ikon) és hangjelzés
- A fejlécben lévő értesítés-harang (`NotificationBell`) összegyűjti a munkamenet alatt érkezett élő eseményeket (új incidens, kritikus kapacitás), kattintva az érintett helyre navigál.
- **Beállítások** oldalon: hangjelzés be/ki kapcsolása + "Teszt" gomb, betűméret-skálázás, saját fiókadatok, bejelentkezési előzmények (2FA-kódküldés, sikertelen próbálkozások is látszanak itt), 2FA saját ki/bekapcsolása.

### 5.13 Súgó (`/sugo`)
- Új, kész funkció: lépésenkénti, harmonika-elrendezésű útmutató a teljes munkafolyamathoz (események → regisztráció → QR → szállítás → térkép → családok → incidensek → visszatelepítés → napló → felhasználók stb.), szerepkörönként jelölve, sok helyen közvetlen hivatkozással az adott funkcióra.
- *Ez akár a demó "tartalomjegyzékeként" is bemutatható* elején vagy végén: "íme, ez a végigvezető, amit egy új kolléga is tud követni".

---

## 6. Mi az, ami "automatikusan" történik — gyors összefoglaló (ha erre külön rákérdeznek)

Mind a Laravel Reverb WebSocket-szerveren keresztül, **frissítés/F5 nélkül**:

1. **Dashboard kapacitás-/kockázat-táblázat** — frissül, ha valahol érkeztetés/áthelyezés történik.
2. **Incidens-toast** — új incidensnél vagy amikor egy befogadóhely kritikus kockázati szintre lép.
3. **Busz-pozíció mozgás** — a Szállítás és a Térkép oldalon egyszerre.
4. **Napló élő aktivitás-csík** — az összes lényeges hatósági művelet valós időben megjelenik rajta.
5. **Hangjelzés** — két rövid sípoló hang új incidens/kritikus esemény esetén, ha be van kapcsolva.
6. **Kapcsolat-állapot ikon** — mutatja, ha a live-kapcsolat megszakad.

Mindezt a `demo:simulate-activity` / `demo:full-scenario` parancsokkal lehet **kézi kattintgatás nélkül**, folyamatosan, élőben megmutatni a képernyőn.

---

## 7. Amit érdemes őszintén bevállalni (ismert korlátok)

Ha rákérdeznek, ne kerülgesd — ezek tudatos, dokumentált egyszerűsítések, nem hiányosságok:

- A szállítóeszközök GPS-pozíciója **szimulált**, nincs valós hardver-integráció mögötte.
- Nincs még **PWA/offline** támogatás — ez a következő fejlesztési fázis, és pont a gyenge helyszíni internetkapcsolat miatt fontos (gyülekezőpontok, befogadóhelyek).
- Nincs SMS-értesítés, csak e-mail (2FA-kódokhoz már be van kötve).
- A rendszer jelenleg egyetlen vármegyére/szervezetre lett optimalizálva (nincs multi-tenant elkülönítés).

---

## 8. Gyors indítási checklist a demó reggelén

- [ ] `npm run dev` a gyökérből (backend + Reverb + frontend egyszerre)
- [ ] Ellenőrizd a fejléc wifi-ikonját: kapcsolódott állapotban van-e
- [ ] `php artisan demo:full-scenario` lefuttatva → van egy kész, ~300 fős aktív esemény
- [ ] Bejelentkezés admin/vezető felhasználóval, 2FA-kód átvétele leellenőrizve (Mailtrap fiók elérhető)
- [ ] Második terminál nyitva, készen a `php artisan demo:simulate-activity` indítására a bemutató közepén
- [ ] Két böngészőfül/eszköz nyitva (Szállítás + Térkép, illetve Dashboard + Napló) az élő szinkron bemutatásához
