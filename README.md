# Lakossági Kitelepítés Támogató Rendszer

Katasztrófavédelmi kitelepítés-/befogadóhely-kezelő webalkalmazás, amelyet a **GYMS Vármegyei Katasztrófavédelmi Igazgatóság** munkájának támogatására terveztünk. A rendszer az Interreg Magyarország–Szlovákia program keretében készült tanulmány ("Lakossági kitelepítés informatikai támogatása") funkcióspecifikációja alapján épült fel, és azt a folyamatot digitalizálja, amely egy tömeges kitelepítés (árvíz, ipari baleset, egyéb veszélyhelyzet) esetén lezajlik: a lakosság regisztrációjától a gyülekezőponton át a befogadóhelyi elhelyezésen, a szállítás nyomon követésén, a családegyesítésen egészen a visszatelepítésig.

Ez a README a projekt **teljes, technikai áttekintését** adja: mi van benne, hogyan kell telepíteni és futtatni, milyen szerepkörök és funkciók léteznek, és mi vár még kidolgozásra. Egy **konkrét, élő használati szituációt** a [`README_HASZNALATI_PELDA.md`](README_HASZNALATI_PELDA.md) fájl mutat be, végigkövetve egy kitalált árvízi kitelepítést az esemény létrehozásától a lezárásig.

---

## Tartalomjegyzék

1. [Mi ez a rendszer?](#mi-ez-a-rendszer)
2. [Tech stack](#tech-stack)
3. [Architektúra](#architektúra)
4. [Szerepkörök és jogosultságok](#szerepkörök-és-jogosultságok)
5. [Funkciók modulonként](#funkciók-modulonként)
6. [Telepítés és futtatás](#telepítés-és-futtatás)
7. [Tesztelés](#tesztelés)
8. [API dokumentáció](#api-dokumentáció)
9. [Projektstruktúra](#projektstruktúra)
10. [Adatvédelem és biztonság](#adatvédelem-és-biztonság)
11. [Mi hiányzik még / roadmap](#mi-hiányzik-még--roadmap)
12. [Ismert korlátok](#ismert-korlátok)

---

## Mi ez a rendszer?

Veszélyhelyzet esetén (árvíz, ipari baleset, tűz stb.) a katasztrófavédelem lakossági tömegeket telepít ki érintett településekről ideiglenes befogadóhelyekre. Ez papíralapon vagy táblázatokban kezelve rendkívül nehézkes: nem látható valós időben, hány ember hol tartózkodik, mely befogadóhelyek telnek meg, mely családok szakadtak szét, vagy kik igényelnek speciális ellátást (mozgáskorlátozottak, gyógyszeres kezelés alatt állók, állattartók stb.).

A rendszer célja, hogy egy adott **kitelepítési eseményhez** (pl. "2026. tavaszi árvíz – Mosoni-Duna") kötve:

- rögzítse a kitelepített személyeket és családjaikat (helyszíni regisztrációval vagy a lakosság saját előregisztrációjával),
- QR-kód alapú azonosítással kövesse végig az utat gyülekezőponttól a befogadóhelyig (esetleg szállítóeszközön keresztül),
- valós idejű áttekintést adjon a befogadóhelyek kapacitásáról, kockázati szintjéről és a demográfiai/igény-eloszlásról,
- támogassa a családegyesítést, a rendkívüli események (panasz, konfliktus, kár) kezelését, és a visszatelepítés engedélyezését településenként,
- mindezt naplózza (ki, mikor, mit módosított) az utólagos elszámoltathatóság és adatvédelmi megfelelés érdekében.

## Tech stack

### Backend

| Komponens | Technológia |
|---|---|
| Nyelv / futtatókörnyezet | PHP 8.2 |
| Keretrendszer | Laravel 12 |
| Autentikáció | Laravel Sanctum (session-alapú SPA autentikáció) + kétfaktoros hitelesítés (e-mail kód) |
| Real-time / WebSocket | Laravel Reverb (önhosztolt, Pusher-kompatibilis protokoll) |
| E-mail küldés | Mailtrap Sending API (`symfony/mailtrap-mailer`) — 2FA-kódokhoz |
| Adatbázis (fejlesztés) | SQLite (in-memory, teszteléshez) |
| Adatbázis (produkció / bemutató) | MySQL / MariaDB (InnoDB) |
| API dokumentáció | L5-Swagger (OpenAPI 3, `darkaonline/l5-swagger`) |
| Tesztelés | PHPUnit 11, `RefreshDatabase` |
| Kódstílus | Laravel Pint |
| Ütemezett feladatok | Laravel Scheduler (`routes/console.php`) |

### Frontend

| Komponens | Technológia |
|---|---|
| Nyelv | TypeScript |
| Keretrendszer | React 19 |
| Build eszköz | Vite |
| UI komponenskönyvtár | MUI (Material UI) v7 |
| Routing | React Router v7 |
| Térkép | Leaflet + react-leaflet (OpenStreetMap csempék) |
| Diagramok | Recharts |
| HTTP kliens | Axios |
| QR-kód generálás/olvasás | `qrcode.react`, `jsqr` (kamerás beolvasás) |
| Értesítések | `react-toastify` |
| Real-time / WebSocket | Laravel Echo + `pusher-js` (Reverb-kompatibilis) |
| Dátumkezelés | `date-fns`, MUI X Date Pickers |
| Linter | oxlint |

### Miért ez a választás?

- A **Laravel + Sanctum SPA session** kombináció egyszerű, biztonságos, cookie-alapú autentikációt ad anélkül, hogy külön JWT-kezelést kellene bevezetni — ehhez a méretű, egy szervezet által üzemeltetett belső rendszerhez ez a pragmatikus megoldás.
- A **React + MUI** gyors, konzisztens admin felületet biztosít táblázatokkal, szűrőkkel, dialógusokkal — ezek nagy része MUI-ból "készen" jön, így a fejlesztési idő a tényleges üzleti logikára fordítható.
- A **Leaflet + OpenStreetMap** ingyenes, nem igényel API-kulcsot vagy fizetős térképszolgáltatót, ami egy közigazgatási/katasztrófavédelmi rendszernél fontos szempont.
- A **Laravel Reverb** önhosztolt WebSocket-szerver, nem igényel külső fizetős szolgáltatót (pl. Pusher-előfizetést) — ugyanaz a "nincs felesleges külső függőség" elv vezérelte, mint a térképszolgáltató választását.

## Architektúra

```
szakdoga/
├── backend/     # Laravel 12 REST API
└── frontend/    # React 19 + Vite SPA
```

A két alkalmazás **különálló folyamatként** fut és HTTP(S)-en keresztül kommunikál (`VITE_API_BASE_URL` a frontend `.env`-ben, `FRONTEND_URLS` / `SANCTUM_STATEFUL_DOMAINS` a backend `.env`-ben). A backend nem szolgál ki HTML-t (kivéve az API doksit) — tisztán JSON API.

### Backend rétegek

- **Controllers** (`app/Http/Controllers/Api`) — HTTP be-/kimenet, validáció delegálása, OpenAPI (`#[OA\...]`) attribútumok minden végponton.
- **Form Requests** (`app/Http/Requests`) — bemenet validáció ott, ahol a controller-szintű `$request->validate()`-nél komplexebb szabályokra van szükség.
- **Resources** (`app/Http/Resources`) — a válasz JSON alakja (pl. `PersonResource` maszkolja az érzékeny mezőket auditor szerepkörnél).
- **Policies** (`app/Policies`) — szerepkör-alapú jogosultság-ellenőrzés (`$this->authorize(...)`).
- **Actions** (`app/Actions`) — egy-egy összetettebb üzleti művelet (pl. `IssueQrTokenAction`, regisztráció létrehozás), hogy a controllerek vékonyak maradjanak.
- **Services** (`app/Services`) — újrafelhasználható logika, pl. `CapacityRiskService` (befogadóhelyi kockázatszámítás), `StockForecastService` (napi készletigény-előrejelzés), `AuditService`, `FamilySplitWarningService`, `DemographicsService`.
- **Events** (`app/Events`) — WebSocketen kiküldött (broadcast) események, pl. `ShelterCapacityUpdated`, `IncidentCreated` (lásd `routes/channels.php` a csatorna-jogosultságokhoz).
- **Enums** (`app/Enums`) — PHP natív enumok minden zárt értékkészletre (`RegistrationStatus`, `RoleCode`, `RiskLevel` stb.), mindegyiken `label()` metódussal a magyar megjelenítéshez (exportokhoz, naplóhoz).

### Frontend rétegek

- **`features/`** — oldalanként/modulonként szervezett komponensek (pl. `features/persons`, `features/shelters`, `features/transports`).
- **`components/ui/`** — újrafelhasználható, "buta" UI elemek (`EmptyState`, `ErrorState`, `ConfirmDialog`, `RiskBadge`, `SpecialNeedIcon`, `MunicipalityAutocomplete` stb.).
- **`components/layout/`** — `AppLayout` (fő navigáció, fiók menü), `EventSubNav` (esemény-alközepontok közti gyorsváltó sáv, egyben a WebSocket-feliratkozás élettartamának gazdája egy adott eseményen belül).
- **`lib/api/endpoints.ts`** — az összes backend hívás egy helyen, típusos válaszokkal.
- **`lib/echo.ts`** — a WebSocket (Laravel Echo/Reverb) kapcsolat singleton kliense, a bejelentkezéshez/kijelentkezéshez kötve.
- **`app/router.tsx`** — a teljes útvonaltérkép (lásd lentebb).

## Szerepkörök és jogosultságok

A rendszer öt szerepkört különböztet meg, mindegyik a valós szervezeti feladatkörnek felel meg:

| Szerepkör | Leírás | Jellemző jogosultságok |
|---|---|---|
| **Rendszergazda** (`admin`) | Felhasználók, szerepkörök, alapadatok (települések, befogadóhelyek, járművek) és események kezelése. | Minden, beleértve felhasználó-kezelést és törléseket is. |
| **Műveleti vezető** (`manager`) | Dashboard, jelentések, esemény állapot, kapacitások áttekintése. | Esemény létrehozás/szerkesztés, jelentés export, de nincs felhasználó-kezelés. |
| **Regisztrátor** (`registrar`) | Személyek és családok rögzítése, QR-kód generálás. | Regisztráció, családkezelés — nincs hozzáférése a naplóhoz vagy alapadat-törléshez. |
| **Befogadóhelyi kezelő** (`shelter_operator`) | QR-beolvasás, érkeztetés, kapacitásfigyelés a **saját** befogadóhelyén. | Csak a hozzárendelt befogadóhelyre korlátozott műveletek. |
| **Auditor / megfigyelő** (`auditor`) | Naplók és jelentések megtekintése. | Csak olvasási jog; a személyes adatok (telefonszám, cím, okmányszám) maszkolva jelennek meg neki (`data_masked` flag a `PersonResource`-ban). |

A jogosultság-ellenőrzés minden végponton Laravel Policy-vel történik, tehát a frontend UI-elemek elrejtése (pl. gombok) csak kényelmi szolgáltatás — a tényleges védelem a backend oldalon van.

## Funkciók modulonként

### 1. Események (`EvacuationEvent`)
Egy kitelepítési esemény (pl. egy adott árvízi vagy ipari baleseti helyzet) a rendszer alapegysége. Állapotai: `tervezet` → `aktív` → `szüneteltetve`/`lezárva`. Egy eseményhez több befogadóhely rendelhető, mindegyikhez egyedi kapacitás-korláttal (ugyanaz a fizikai befogadóhely több eseményben is szerepelhet más-más kapacitással).

### 2. Regisztráció és személyek
- **Helyszíni regisztráció** (regisztrátor tölti ki): név, születési adatok, lakcím, telefon, speciális igények, állatok, család hozzárendelés.
- **Lakossági önkiszolgáló előregisztráció**: bejelentkezés nélkül elérhető nyilvános link (`/onkiszolgalo/:eventCode`), amivel a lakosság még a kitelepítés helyszíni megkezdése előtt regisztrálhat, és QR-kódot (digitális "kitelepítési igazolványt") kap. Az érintett később a saját profilját is szerkesztheti, és megerősítheti a gyülekezőponti érkezését/hazatérését.
- **Tömeges import**: CSV-ből egyszerre több személy rögzíthető és QR-kóddal láthatók el.
- Minden regisztrációhoz tartozik: állapot (`regisztrált` → `megjelent a gyülekezőn` → `szállítás alatt` → `megérkezett` → `elhagyta a befogadóhelyet` → `hazatért` / `eltűnt` / `törölt`), csatorna (hatósági / önkiszolgáló), speciális igények (egészségügyi, mozgás-/érzékszervi, életkor szerinti, diétás, állattartási, egyéb — mindegyik saját katalógusból választható típussal), állatok, dokumentumfotók.

### 3. QR-kód alapú azonosítás
Minden személyhez (vagy egy egész családhoz) kiadható egy egyedi QR-kód ("digitális karszalag"). Ezt a rendszer beolvassa (kamerával vagy kézi bevitellel) a gyülekezőponton, a befogadóhelyi érkeztetéskor és a szállítóeszközre fel-/leszálláskor. **Elveszett kód** esetén új kód adható ki, ami a régit érvényteleníti, és ezt a naplóban külön, kiemelt (`qr_reissue_lost`) eseményként rögzíti a rendszer — megkülönböztetve a rutinszerű kiadástól.

### 4. Befogadóhelyek és érkeztetés
- Befogadóhely törzsadat (kapacitás, elérhető szolgáltatások: orvosi ellátás, ivóvíz, étkezés, higiéniás létesítmények, gyermekfelügyelet, pszichológiai támogatás, házirend).
- Egy adott eseményhez rendelt befogadóhelyek kapacitás-korláttal és valós idejű foglaltsággal.
- **Kockázatszámítás** (`CapacityRiskService`): a telítettség és a beérkezési ütem alapján alacsony/közepes/magas/kritikus kockázati szintet számol, és előrejelzi, hány óra múlva telik meg a hely.
- Érkeztetés QR-beolvasással, ágyhoz rendeléssel, ideiglenes eltávozás/visszatérés rögzítésével.
- Befogadóhelyek közti **áthelyezés**, ami automatikusan figyelmeztet, ha emiatt egy család szétszakadna.
- **Nyomtatható/PDF-exportálható névsor** egy adott befogadóhelyről (böngésző natív nyomtatás → PDF).

### 5. Szállítás és jármű-nyilvántartás
- Járműflotta (busz, kisbusz, vonat, autó, mentő, teherautó, egyéb) törzsadata, kapacitással.
- Egy adott eseményhez rendelt szállítóeszközök (indulási/célállomás, kísérő, tervezett indulás/érkezés, késés, útvonalváltozás).
- Utasok fel-/leszállásának QR-alapú rögzítése, tömeges "szervezett utaslista" import CSV-ből.
- Szimulált GPS-pozíció (mivel nincs valós jármű-GPS integráció) a térképes koncepció demonstrálására — a pozícióváltás **valós idejű (WebSocket)**, tehát ha valaki máshol szimulál egy mozgást, a Szállítás és a Térképes áttekintés oldalon is azonnal, frissítés nélkül mozdul a busz-marker.

### 6. Családkezelés és családegyesítés
- Családok automatikus vagy kézi csoportosítása, kapcsolattartó kijelölése.
- **Családegyesítési munkalista**: azok a családok, amelyek tagjai jelenleg különböző befogadóhelyeken tartózkodnak — bővíthető kártyás nézetben, kattintható taggal (átnavigál a személy adatlapjára) és opcionális térképnézettel (csak lenyitáskor jelenik meg, hogy hol vannak most a tagok).
- Automatikus **családszétválás-figyelmeztetés** érkeztetéskor/áthelyezéskor, ha ez szétszakítaná a családot.
- Ügyintézési bejegyzések (megoldva/nem megoldva jelöléssel) egy-egy szétszakadt családhoz.

### 7. Térképes áttekintés
- Befogadóhelyek valós koordináták szerint, szállítóeszközök (szimulált) pozíciója, gyülekezési pontok.
- A regisztrált személyek **adatvédelmi okból nem egyedi címükön**, hanem lakóhelyük (település) szerint, összesítve jelennek meg.
- Ugyanez a településenkénti összesítés külön szűrhető a központi szállítást igénylő személyekre is.

### 8. Dashboard és jelentések
- Esemény-szintű KPI-k (regisztráltak, családok, megérkezettek, központi szállítást/elszállásolást igénylők, hiányzók száma), mindegyik kattintható, szűrt személylistára navigál.
- Demográfiai bontás (nem, kor), regisztrációk időbeli alakulása, speciális igény szerinti eloszlás — mind diagramban (Recharts), mind kattintható KPI-kártyaként.
- **Befogadóhelyi kapacitás- és kockázat-táblázat, valós idejű (WebSocket) frissítéssel**: érkeztetéskor/áthelyezéskor a dashboardot néző staff azonnal, pollozás/frissítés nélkül látja a változást (lásd [Architektúra](#architektúra), `ShelterCapacityUpdated` esemény).
- **Napi készletigény-előrejelzés**: a jelenleg befogadóhelyen tartózkodók száma és igényei alapján becsült napi étkezési adag-, takaró-, matrac- és gyógyszerigény, befogadóhelyenkénti bontásban, kattintható mutatókkal.
- Exportok: CSV a személyi listáról, a befogadóhelyi névsorról és az összesítő jelentésről (utóbbi kettő magyar nyelvű, olvasható címkékkel).

### 9. Rendkívüli események (incidensek)
Panasz, konfliktus, biztonsági esemény, kár vagy egyéb bejelentése egy adott befogadóhelyhez és/vagy személyhez kötve, súlyossággal (alacsony/közepes/magas) és megoldás-nyomon követéssel. Új incidens bejelentésekor, illetve amikor egy befogadóhely újonnan éri el a kritikus kockázati szintet, **élő toast-értesítés** jelenik meg minden, az adott eseményt épp néző, jogosult staffnak (WebSocketen, nem pollozással).

### 10. Visszatelepítés
Településenkénti visszatelepítési engedélyezési státusz (nem engedélyezett / feltételes / engedélyezett), feltételek megjegyzéssel, engedélyezési időablakkal, és a ténylegesen hazatértek számának követésével.

### 11. Naplózás és auditálás
Minden lényeges művelet (létrehozás, módosítás, törlés, érkeztetés, státuszváltás, áthelyezés, QR-kiadás, szállítás fel-/leszállás, bejelentkezés/kijelentkezés, felhasználó- és szerepkör-módosítás stb.) egységes naplóba kerül, előtte/utána állapottal, szűrhető felhasználó, esemény, entitástípus, művelet és időintervallum szerint, **napi összesítővel**. Auditor szerepkörnél a személyes adatok maszkolva jelennek meg a naplóban is. CSV export magyar nyelvű címkékkel. A napló tetején egy **élő "aktivitás" csík** (WebSocket) mutatja a legutóbbi bejegyzéseket (ki, mit csinált, mikor) admin/vezető/auditor szerepkörnek, frissítés nélkül — a csík maga nem tartalmaz érzékeny adatot (before/after állapotot), csak a teljes, megfelelően maszkolt naplóban kattintva.

### 12. Felhasználó- és alapadat-kezelés
Felhasználók (szerepkör-hozzárendeléssel, avatárral, befogadóhely-hozzárendeléssel befogadóhelyi kezelőknél), települések (kereshető törzsadat-lista, térképes koordináta-választóval), befogadóhelyek, járművek — mindegyik admin/vezető jogosultsághoz kötött CRUD felülettel.

### 13. Fiókbeállítások
Saját profil szerkesztése, jelszócsere, bejelentkezési előzmények megtekintése (beleértve a kiküldött 2FA-kódokat és a sikertelen kódpróbálkozásokat is), valamint a saját kétfaktoros hitelesítés be-/kikapcsolása (lásd lentebb).

### 14. Bejelentkezés és kétfaktoros hitelesítés (2FA)
Alapértelmezetten minden belépő (nem lakossági) felhasználó számára **kötelező** a kétlépcsős bejelentkezés: helyes jelszó megadása után a rendszer egy 6 jegyű, 10 percig érvényes kódot küld e-mailben, amit a felhasználónak meg kell adnia a tényleges bejelentkezés befejezéséhez. 5 egymást követő hibás kód után a folyamatban lévő belépés lezárul, újra kell kezdeni. A kódküldés (`two_factor_sent`) és a sikertelen kódpróbálkozás (`login_2fa_failed`) is auditnaplózott esemény.

A `users.two_factor_enabled` mező (alapértelmezetten `true`) lehetővé teszi, hogy egy már bejelentkezett felhasználó a Fiókbeállítások oldalon **saját magának** kikapcsolja a 2FA-t — ez elsősorban fejlesztés/tesztelés közbeni kényelmi opció (hogy ne kelljen minden bejelentkezéskor e-mailt ellenőrizni), nem globális biztonsági kapcsoló: kikapcsolva a `/api/login` a jelszó ellenőrzése után rögtön bejelentkeztet, kód küldése nélkül. Új felhasználóknál (és alapértelmezésben mindenkinél) a 2FA bekapcsolva marad.

## Telepítés és futtatás

### Előfeltételek

- PHP 8.2+, Composer
- Node.js (Vite 8-hoz ajánlott egy friss LTS verzió) és npm
- MySQL/MariaDB (produkciós/bemutató célra) — fejlesztéshez elég a beépített SQLite
- Egy (ingyenes) [Mailtrap](https://mailtrap.io) fiók API-tokennel — a kétfaktoros hitelesítéshez szükséges e-mail-küldéshez

### Backend (Laravel API)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Fejlesztéshez az `.env` alapértelmezett `DB_CONNECTION=sqlite` beállítása működik (hozz létre egy üres `database/database.sqlite` fájlt, ha még nincs). Bemutatóhoz/produkcióhoz kapcsold MySQL-re:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=kitelepites
DB_USERNAME=root
DB_PASSWORD=
```

Majd:

```bash
php artisan migrate --seed
php artisan serve
```

> **Windows-on, ha `php artisan serve` mojibake/encoding hibával elszáll** (jellemzően ékezetes karaktereket tartalmazó projekt-elérési útnál fordul elő): használd helyette a `php -S localhost:8000 -t public` parancsot ugyanabból (`backend/`) könyvtárból — funkcionálisan egyenértékű, csak a beépített fejlesztői szerver más belépési útját használja.

A `--seed` kapcsoló feltölti az alap szerepköröket, egy admin felhasználót, néhány mintatelepülést és befogadóhelyet (lásd `database/seeders/`). A `SyntheticRegistrationSeeder` szintetikus (kitalált) regisztrációs adatokat is generál demonstrációs/teszt céllal.

A backend alapértelmezetten a `http://localhost:8000` címen fut. Állítsd be a `.env`-ben a frontend URL-jét CORS/Sanctum miatt:

```env
FRONTEND_URLS=http://localhost:5173
SANCTUM_STATEFUL_DOMAINS=localhost:5173
```

#### E-mail küldés (kétfaktoros hitelesítéshez)

A 2FA-kódok kiküldéséhez valós SMTP/API-alapú levélküldő kell (a `MAIL_MAILER=log` csak naplózna, nem küldene ki semmit). A projekt a Mailtrap Sending API-t használja:

```env
MAIL_MAILER=mailtrap
MAILTRAP_HOST=default
MAILTRAP_KEY=            # a saját Mailtrap fiókod API-tokenje
MAIL_FROM_ADDRESS="hello@demomailtrap.co"
MAIL_FROM_NAME="${APP_NAME}"

# Amíg a seedelt staff felhasználók e-mail címei (pl. @katasztrofavedelem.test)
# nem valós postafiókok, minden 2FA-kód erre a címre megy a felhasználó
# tényleges e-mail címe helyett:
TWO_FACTOR_TEST_RECIPIENT=sajat.cimed@example.com
```

A kódküldés **szinkron** (a `/api/login` kérés részeként történik, nem queue-olt) — nincs szükség külön queue worker-re ehhez a funkcióhoz.

#### WebSocket / real-time frissítés (Laravel Reverb)

A dashboard élő kapacitás-/kockázatfrissítéséhez és az incidens-toastokhoz egy **külön, folyamatosan futó Reverb-szerver** szükséges (ez nem kerülhető meg — WebSocket-szerver nélkül nincs push):

```bash
php artisan reverb:install   # csak első alkalommal: legenerálja a REVERB_* env változókat
php artisan reverb:start
```

A `reverb:install` a `.env`-be írja a `REVERB_APP_ID`/`REVERB_APP_KEY`/`REVERB_APP_SECRET`/`REVERB_HOST`/`REVERB_PORT`/`REVERB_SCHEME` (és a nekik megfelelő `VITE_REVERB_*`) változókat. Az `APP_KEY`/`PORT`/`SCHEME` értékeket másold át a **frontend** `.env`-jébe is (lásd lentebb), mert a Vite csak a saját `.env`-jét olvassa — a `REVERB_HOST`-ot viszont **NE** másold változatlanul: Windows-on állítsd a backend `.env`-jében `127.0.0.1`-re (lásd a teljesítménycsapda-figyelmeztetést lentebb), a frontendben pedig maradjon `localhost` (a böngésző-kliensnek ott nincs ugyanaz a lassulása, és a sütikezeléshez is ez kell).

### Frontend (React SPA)

```bash
cd frontend
npm install
```

Hozz létre egy `.env` fájlt:

```env
VITE_API_BASE_URL=http://localhost:8000

# A backend .env-jéből a reverb:install által generált REVERB_APP_KEY/HOST/PORT/SCHEME
# értékek (ezek nem titkosak — a Reverb/Pusher "app key" tervezetten publikus,
# minden böngésző-kliens ezzel nyit WebSocket-kapcsolatot):
VITE_REVERB_APP_KEY=
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

Majd:

```bash
npm run dev
```

A frontend alapértelmezetten a `http://localhost:5173` címen fut.

### Mindhárom egyszerre (backend + Reverb + frontend, egy paranccsal)

A repo gyökerében van egy `package.json`, ami a `concurrently` csomaggal egyetlen paranccsal indítja a backend PHP szervert, a Reverb WebSocket-szervert és a frontend Vite dev szervert (a kimenetük színkódolva, egymás mellett jelenik meg egy terminálban):

```bash
npm install   # csak első alkalommal, a repo gyökeréből
npm run dev
```

Ez a `php -S localhost:8000 -t public`, a `php artisan reverb:start` és a frontend `npm run dev` parancsokat futtatja párhuzamosan. **Előfeltétel**: a backend és a frontend `.env`-je már be legyen állítva (lásd fent), és a `php artisan reverb:install` már lefusson egyszer (ez generálja a `REVERB_*` változókat) — ez a gyökér szkript ezeket nem pótolja, csak a napi indítást gyorsítja fel. 2FA-hoz (Mailtrap SMTP) nincs külön futó folyamat szükséges, mert a 2FA-email küldése szinkron, nem sorba állított.

Alternatívaként a backend `composer.json`-ja tartalmaz egy `composer dev` szkriptet is, ami a Laravel szervert, a sor (queue) figyelőt, a naplókövetőt és a Vite dev szervert indítja (Reverb nélkül):

```bash
cd backend
composer dev
```

### Élő demó / fejlesztői teszt a WebSocket-frissítéshez

A `demo:simulate-activity` artisan parancs valós Action-osztályokon (érkeztetés, áthelyezés, szállítóeszköz-pozíció, incidens) keresztül folyamatosan generál eseményeket egy megadott kitelepítési eseményhez, hogy a real-time frissítés böngészőben, kézi kattintgatás nélkül megfigyelhető legyen:

```bash
cd backend
php artisan demo:simulate-activity              # az EVT-2026-001 eseményhez, 4 másodpercenként
php artisan demo:simulate-activity EVT-2026-002 --interval=2 --duration=60
```

Nyisd meg a dashboardot böngészőben, indítsd el a parancsot egy külön terminálban, és figyeld, ahogy a kapacitás-/kockázat-táblázat élőben frissül, illetve incidens-toast jelenik meg. **Ez tisztán fejlesztői/bemutató célú eszköz**, nem éles adatgenerálásra szánt.

Egy második, ennél nagyobb léptékű parancs, a `demo:full-scenario`, **egy (opcionálisan `--events`-szel több) új eseményt** hoz létre a semmiből, **kb. 300 fős** népességgel (Faker hu_HU-val generált családok + önkiszolgáló egyének, kb. a `README_HASZNALATI_PELDA.md` forgatókönyvéhez hasonló elemekkel: szállítás, szándékos családszétválás és -egyesítés, incidens, visszatelepítés), kizárólag valós Action-osztályokon keresztül. Két fázisból áll: egy **gyors, tömeges feltöltésből** (nincs mesterséges késleltetés — kb. 30 másodperc ~300 főre), majd egy **valóban élő tempójú záró szakaszból**, ami véletlenszerűen érkeztet/áthelyez/incidenst jelent/pozíciót szimulál, hogy böngészőben ténylegesen követhető legyen. A végén egy **önellenőrző riportot** ír ki (✔ OK / ⚠ FIGYELEM soronként), ami összeveti a várt és a tényleges rendszerállapotot — ez a legjobb módja annak, hogy nagy volumenű, változatos adaton derüljön ki, ha valahol elszakad a lánc a modulok között:

```bash
cd backend
php artisan demo:full-scenario                                    # 1 esemény, ~300 fő, 40 élő akció
php artisan demo:full-scenario --people=30 --live-actions=15 --interval=1
php artisan demo:full-scenario --events=3                         # ha mégis több eseményt akarsz egyszerre
```

> **Windows-specifikus teljesítménycsapda**: a `REVERB_HOST` értéke szándékosan `127.0.0.1`, NEM `localhost` — ez utóbbi Windows-on a backend PHP-kliensében (nem a böngészőben — ott nem probléma) kb. 200ms/hívás pluszterhelést okozott broadcast eseményenként (IPv6→IPv4 DNS-visszaesés), ami tömeges adatgeneráláskor (pl. ~400 fő regisztrálásakor, egyenként több auditnapló-bejegyzéssel) **percekben mérhető lassulást** jelentett (2 percen túli timeout helyett kb. 30 másodperc a javítás után). Ha saját `.env`-edben `REVERB_HOST=localhost` van, és a broadcast-tal járó műveletek (bármi, ami `AuditService::log()`-ot hív) gyanúsan lassúak, cseréld `127.0.0.1`-re.

Az esemény a végén **aktív** állapotban marad (nem záródik le), hogy utána böngészőben is lehessen vele kísérletezni. Ismételt futtatásra minden alkalommal új eseményt hoz létre (a befogadóhelyek/települések törzsadatai újrahasznosulnak).

## Tesztelés

```bash
cd backend
php artisan test
# vagy közvetlenül:
./vendor/bin/phpunit
```

A teszteket SQLite in-memory adatbázison futtatja (`RefreshDatabase` trait), ezért ezek nem érintik a fejlesztői/produkciós adatbázist. A tesztlefedettség elsősorban **Feature teszt** szintű: a teljes HTTP kérés–válasz folyamatot ellenőrzi (regisztráció, érkeztetés, áthelyezés, családegyesítés, exportok, jogosultságok stb.).

Frontend oldalon típusellenőrzés és build:

```bash
cd frontend
npm run build   # tsc -b && vite build
npm run lint    # oxlint
```

### Vizuális, statikus tesztriport (backend + frontend együtt)

A `scripts/test-report.ps1` (Windows/PowerShell) vagy `scripts/test-report.sh` (bash) egy paranccsal lefuttatja mindkét teszt-csomagot, és egy önálló, böngészőben megnyíló HTML riportot generál — %-os összesítő, kördiagram sikeres/sikertelen/kihagyott arányról, osztályonkénti/fájlonkénti bontás és a hibaüzenetek listája:

```powershell
.\scripts\test-report.ps1              # mindkét csomag
.\scripts\test-report.ps1 -Suite backend
```

```bash
./scripts/test-report.sh               # mindkét csomag
./scripts/test-report.sh backend
```

A script mindig a repo gyökeréből, egy friss terminálfolyamatból indítja közvetlenül a `vendor/bin/phpunit`-et/`vitest`-et (nem egy már futó Laravel-folyamaton, pl. egy Artisan parancson keresztül) — ez szándékos: egy korábbi kísérlet során kiderült, hogy egy már bootstrapolt Laravel-alkalmazásból indított gyermek tesztfolyamat örökölheti a szülő éles `.env`-jét, és emiatt a `RefreshDatabase` a valódi fejlesztői adatbázist törölhetné a teszt SQLite in-memory helyett. Innen indítva ez a kockázat nem áll fenn. Az eredmény a (git által figyelmen kívül hagyott) `reports/test-report.html` fájlba kerül.

## API dokumentáció

A backend minden végpontját OpenAPI (Swagger) attribútumokkal dokumentáltuk közvetlenül a controllerekben. A dokumentáció újragenerálása és megtekintése:

```bash
cd backend
php artisan l5-swagger:generate
php artisan serve
# majd böngészőben: http://localhost:8000/api/documentation
```

## Projektstruktúra

```
backend/
├── app/
│   ├── Actions/            # Egy-egy összetettebb üzleti művelet
│   ├── Console/Commands/   # Ütemezett/kézi artisan parancsok (pl. lejárt adatok törlése, élő demó)
│   ├── Enums/              # Zárt értékkészletek label() metódussal
│   ├── Events/             # WebSocketen broadcastolt események (ShelterCapacityUpdated, IncidentCreated)
│   ├── Http/
│   │   ├── Controllers/Api/
│   │   ├── Requests/
│   │   └── Resources/
│   ├── Mail/                # Kiküldött e-mailek (pl. TwoFactorCodeMail)
│   ├── Models/
│   ├── Policies/
│   └── Services/
├── database/
│   ├── migrations/
│   ├── factories/
│   └── seeders/
├── routes/
│   ├── api.php
│   ├── channels.php        # WebSocket-csatornák jogosultság-ellenőrzése
│   └── console.php
└── tests/Feature/

frontend/
├── src/
│   ├── app/                # Router
│   ├── components/
│   │   ├── layout/         # AppLayout, EventSubNav
│   │   └── ui/             # Újrafelhasználható UI primitívek
│   ├── constants/
│   ├── features/           # Oldalankénti/modulonkénti komponensek
│   └── lib/
│       ├── api/             # endpoints.ts — az összes backend hívás
│       └── echo.ts          # WebSocket (Laravel Echo/Reverb) kliens
```

## Adatvédelem és biztonság

- **Session-alapú autentikáció** Laravel Sanctummal (nincs kliens oldalon tárolt hosszú élettartamú token).
- **Kötelező kétfaktoros hitelesítés (2FA)** minden belépő (staff) felhasználónak — helyes jelszó után e-mailben kiküldött, 10 percig érvényes 6 jegyű kód szükséges a bejelentkezéshez, max. 5 próbálkozással.
- **Szerepkör-alapú hozzáférés-vezérlés** minden végponton Policy-kkel — a frontend csak elrejti, nem "biztosítja" a jogosultságot. Ugyanezek a Policy-k érvényesülnek a WebSocket-csatornák jogosultság-ellenőrzésén (`routes/channels.php`) is.
- **Adatmaszkolás auditoroknak**: a személyes adatok (telefonszám, cím, okmányszám stb.) auditor szerepkörnél maszkolva jelennek meg listákban és a naplóban is.
- **Automatikus adatmegőrzési törlés**: napi ütemezett parancs (`data:purge-expired-persons`) törli a megőrzési időn túli, lezárt eseményekhez tartozó személyes adatokat, ezt is naplózva.
- **Teljes körű auditnapló**: minden lényeges módosítás visszakövethető (ki, mikor, mit változtatott, előtte/utána állapot).
- **QR-kód érvénytelenítés** elveszett kód bejelentésekor, külön naplóbejegyzéssel.

## Mi hiányzik még / roadmap

A funkcióspecifikáció (és a fejlesztés során felmerült igények) alapján az alábbiak **még nincsenek megvalósítva**, ezek a következő fejlesztési fázis jelöltjei:

- **PWA / offline-first támogatás**: a gyülekezőpontokon és befogadóhelyeken gyakran gyenge vagy nincs internetkapcsolat — egy telepíthető, offline-szinkronizáló kliens (Service Worker + helyi tárolás, majd háttér-szinkron) jelentősen javítaná a helyszíni használhatóságot.
- **Automatizált SMS-emlékeztetők** (pl. visszatelepítési ablak nyílásáról, önkiszolgáló profil frissítési felszólításról) — e-mail-küldés (2FA-kódok, Mailtrap) már be van kötve, de SMS-integráció nincs.
- Valós GPS-integráció a szállítóeszközökhöz (jelenleg csak szimulált pozíció — bár a szimulált pozíció-frissítések is WebSocketen mehetnének élőben, ez még nincs megvalósítva).
- Élő auditnapló-csík adminoknak/auditoroknak (a WebSocket-infrastruktúra, ami a dashboard/incidens real-time frissítését adja, már megvan — ez "csak" egy újabb csatorna/esemény lenne rá).
- Kódszétválasztás/lazy loading a frontend build méretének csökkentésére (a jelenlegi bundle ~600 kB gzip-elve, ami a build figyelmeztetést is kiváltja).

## Ismert korlátok

- A szállítóeszközök pozíciója **szimulált**, nincs mögötte valós GPS-eszköz vagy -integráció — ez tudatos egyszerűsítés, ami a geografikus nyomon követés koncepcióját demonstrálja valós hardver nélkül.
- A rendszer jelenleg **egyetlen vármegyére/szervezetre** optimalizált (nincs multi-tenant elkülönítés több katasztrófavédelmi igazgatóság között).
- Az **e-mail-küldés be van kötve** (Mailtrap Sending API, 2FA-kódokhoz), de **SMS-értesítés nincs**. A Mailtrap ingyenes csomagja demo-domainről küld, és bizonyos korlátokkal (pl. csak a fiók tulajdonosának saját címére enged tesztküldést) — bemutatóhoz/produkcióhoz valós, verifikált küldő-domainre érdemes váltani.
- A **WebSocket real-time frissítéshez** (Laravel Reverb) egy külön, folyamatosan futó szerverfolyamat kell (`php artisan reverb:start`) — ez nem kerülhető meg, WebSocket-szerver nélkül a dashboard visszaesik a kezdeti (egyszeri) betöltésre, élő frissítés nélkül.
