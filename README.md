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
| Autentikáció | Laravel Sanctum (session-alapú SPA autentikáció) |
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
| Dátumkezelés | `date-fns`, MUI X Date Pickers |
| Linter | oxlint |

### Miért ez a választás?

- A **Laravel + Sanctum SPA session** kombináció egyszerű, biztonságos, cookie-alapú autentikációt ad anélkül, hogy külön JWT-kezelést kellene bevezetni — ehhez a méretű, egy szervezet által üzemeltetett belső rendszerhez ez a pragmatikus megoldás.
- A **React + MUI** gyors, konzisztens admin felületet biztosít táblázatokkal, szűrőkkel, dialógusokkal — ezek nagy része MUI-ból "készen" jön, így a fejlesztési idő a tényleges üzleti logikára fordítható.
- A **Leaflet + OpenStreetMap** ingyenes, nem igényel API-kulcsot vagy fizetős térképszolgáltatót, ami egy közigazgatási/katasztrófavédelmi rendszernél fontos szempont.

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
- **Enums** (`app/Enums`) — PHP natív enumok minden zárt értékkészletre (`RegistrationStatus`, `RoleCode`, `RiskLevel` stb.), mindegyiken `label()` metódussal a magyar megjelenítéshez (exportokhoz, naplóhoz).

### Frontend rétegek

- **`features/`** — oldalanként/modulonként szervezett komponensek (pl. `features/persons`, `features/shelters`, `features/transports`).
- **`components/ui/`** — újrafelhasználható, "buta" UI elemek (`EmptyState`, `ErrorState`, `ConfirmDialog`, `RiskBadge`, `SpecialNeedIcon`, `MunicipalityAutocomplete` stb.).
- **`components/layout/`** — `AppLayout` (fő navigáció, fiók menü), `EventSubNav` (esemény-alközepontok közti gyorsváltó sáv).
- **`lib/api/endpoints.ts`** — az összes backend hívás egy helyen, típusos válaszokkal.
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
- Szimulált GPS-pozíció (mivel nincs valós jármű-GPS integráció) a térképes koncepció demonstrálására.

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
- Befogadóhelyi kapacitás- és kockázat-táblázat.
- **Napi készletigény-előrejelzés**: a jelenleg befogadóhelyen tartózkodók száma és igényei alapján becsült napi étkezési adag-, takaró-, matrac- és gyógyszerigény, befogadóhelyenkénti bontásban, kattintható mutatókkal.
- Exportok: CSV a személyi listáról, a befogadóhelyi névsorról és az összesítő jelentésről (utóbbi kettő magyar nyelvű, olvasható címkékkel).

### 9. Rendkívüli események (incidensek)
Panasz, konfliktus, biztonsági esemény, kár vagy egyéb bejelentése egy adott befogadóhelyhez és/vagy személyhez kötve, súlyossággal (alacsony/közepes/magas) és megoldás-nyomon követéssel.

### 10. Visszatelepítés
Településenkénti visszatelepítési engedélyezési státusz (nem engedélyezett / feltételes / engedélyezett), feltételek megjegyzéssel, engedélyezési időablakkal, és a ténylegesen hazatértek számának követésével.

### 11. Naplózás és auditálás
Minden lényeges művelet (létrehozás, módosítás, törlés, érkeztetés, státuszváltás, áthelyezés, QR-kiadás, szállítás fel-/leszállás, bejelentkezés/kijelentkezés, felhasználó- és szerepkör-módosítás stb.) egységes naplóba kerül, előtte/utána állapottal, szűrhető felhasználó, esemény, entitástípus, művelet és időintervallum szerint, **napi összesítővel**. Auditor szerepkörnél a személyes adatok maszkolva jelennek meg a naplóban is. CSV export magyar nyelvű címkékkel.

### 12. Felhasználó- és alapadat-kezelés
Felhasználók (szerepkör-hozzárendeléssel, avatárral, befogadóhely-hozzárendeléssel befogadóhelyi kezelőknél), települések (kereshető törzsadat-lista, térképes koordináta-választóval), befogadóhelyek, járművek — mindegyik admin/vezető jogosultsághoz kötött CRUD felülettel.

### 13. Fiókbeállítások
Saját profil szerkesztése, jelszócsere, bejelentkezési előzmények megtekintése.

## Telepítés és futtatás

### Előfeltételek

- PHP 8.2+, Composer
- Node.js (Vite 8-hoz ajánlott egy friss LTS verzió) és npm
- MySQL/MariaDB (produkciós/bemutató célra) — fejlesztéshez elég a beépített SQLite

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

A `--seed` kapcsoló feltölti az alap szerepköröket, egy admin felhasználót, néhány mintatelepülést és befogadóhelyet (lásd `database/seeders/`). A `SyntheticRegistrationSeeder` szintetikus (kitalált) regisztrációs adatokat is generál demonstrációs/teszt céllal.

A backend alapértelmezetten a `http://localhost:8000` címen fut. Állítsd be a `.env`-ben a frontend URL-jét CORS/Sanctum miatt:

```env
FRONTEND_URLS=http://localhost:5173
SANCTUM_STATEFUL_DOMAINS=localhost:5173
```

### Frontend (React SPA)

```bash
cd frontend
npm install
```

Hozz létre egy `.env` fájlt (vagy másold az `.env.example`-t, ha van):

```env
VITE_API_BASE_URL=http://localhost:8000
```

Majd:

```bash
npm run dev
```

A frontend alapértelmezetten a `http://localhost:5173` címen fut.

### Mindkettő egyszerre (kényelmi szkript)

A backend `composer.json`-ja tartalmaz egy `composer dev` szkriptet, ami egyszerre indítja a Laravel szervert, a sor (queue) figyelőt, a naplókövetőt és a Vite dev szervert:

```bash
cd backend
composer dev
```

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
│   ├── Console/Commands/   # Ütemezett/kézi artisan parancsok (pl. lejárt adatok törlése)
│   ├── Enums/              # Zárt értékkészletek label() metódussal
│   ├── Http/
│   │   ├── Controllers/Api/
│   │   ├── Requests/
│   │   └── Resources/
│   ├── Models/
│   ├── Policies/
│   └── Services/
├── database/
│   ├── migrations/
│   ├── factories/
│   └── seeders/
├── routes/
│   ├── api.php
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
│   └── lib/api/            # endpoints.ts — az összes backend hívás
```

## Adatvédelem és biztonság

- **Session-alapú autentikáció** Laravel Sanctummal (nincs kliens oldalon tárolt hosszú élettartamú token).
- **Szerepkör-alapú hozzáférés-vezérlés** minden végponton Policy-kkel — a frontend csak elrejti, nem "biztosítja" a jogosultságot.
- **Adatmaszkolás auditoroknak**: a személyes adatok (telefonszám, cím, okmányszám stb.) auditor szerepkörnél maszkolva jelennek meg listákban és a naplóban is.
- **Automatikus adatmegőrzési törlés**: napi ütemezett parancs (`data:purge-expired-persons`) törli a megőrzési időn túli, lezárt eseményekhez tartozó személyes adatokat, ezt is naplózva.
- **Teljes körű auditnapló**: minden lényeges módosítás visszakövethető (ki, mikor, mit változtatott, előtte/utána állapot).
- **QR-kód érvénytelenítés** elveszett kód bejelentésekor, külön naplóbejegyzéssel.

## Mi hiányzik még / roadmap

A funkcióspecifikáció (és a fejlesztés során felmerült igények) alapján az alábbiak **még nincsenek megvalósítva**, ezek a következő fejlesztési fázis jelöltjei:

- **Kétfaktoros hitelesítés (2FA)** a belépő (nem lakossági) felhasználóknak.
- **PWA / offline-first támogatás**: a gyülekezőpontokon és befogadóhelyeken gyakran gyenge vagy nincs internetkapcsolat — egy telepíthető, offline-szinkronizáló kliens (Service Worker + helyi tárolás, majd háttér-szinkron) jelentősen javítaná a helyszíni használhatóságot.
- **Valós idejű frissítés WebSocketen (Laravel Echo/Reverb)** a jelenlegi 30 másodperces pollozás helyett a dashboardon és a befogadóhelyi kapacitás-nézeteken — élő push-értesítésekkel (új incidens, befogadóhely megtelt stb.) a bejelentkezett kezelőknek.
- **Automatizált SMS/e-mail emlékeztetők** (pl. visszatelepítési ablak nyílásáról, önkiszolgáló profil frissítési felszólításról) — jelenleg a `MAIL_MAILER=log` és nincs SMS-integráció.
- Valós GPS-integráció a szállítóeszközökhöz (jelenleg csak szimulált pozíció).
- Kódszétválasztás/lazy loading a frontend build méretének csökkentésére (a jelenlegi bundle ~570 kB gzip-elve, ami a build figyelmeztetést is kiváltja).

## Ismert korlátok

- A szállítóeszközök pozíciója **szimulált**, nincs mögötte valós GPS-eszköz vagy -integráció — ez tudatos egyszerűsítés, ami a geografikus nyomon követés koncepcióját demonstrálja valós hardver nélkül.
- A rendszer jelenleg **egyetlen vármegyére/szervezetre** optimalizált (nincs multi-tenant elkülönítés több katasztrófavédelmi igazgatóság között).
- Az e-mail/SMS értesítések nincsenek bekötve külső szolgáltatóhoz (a `.env` alapértelmezett `MAIL_MAILER=log` csak naplóz, ténylegesen nem küld).
