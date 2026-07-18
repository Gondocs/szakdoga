# Használati példa: egy konkrét kitelepítés végigkövetése

Ez a dokumentum egy **kitalált, de reális szituáción** keresztül mutatja be, hogyan használná a GYMS Vármegyei Katasztrófavédelmi Igazgatóság a rendszert egy tényleges kitelepítés során, az esemény meghirdetésétől a lezárásig. A technikai részletekért (telepítés, tech stack, szerepkörök, API) lásd a fő [`README.md`](README.md)-t.

> A forgatókönyv szereplői és a település-/utcanevek kitaláltak, a folyamat viszont a rendszerben ténylegesen megvalósított funkciókat és felhasználói felületeket követi.

---

## A helyzet

**2026. március 14., péntek, 14:00.** A Mosoni-Duna vízállása a tavaszi olvadás és a tartós esőzés miatt gyorsan emelkedik. A Vízügyi Igazgatóság jelzése alapján a GYMS Vármegyei Katasztrófavédelmi Igazgatóság elrendeli **Vámosszabadi, Vének és Kisbajcs** községek lakosságának megelőző kitelepítését a következő 24 órában.

Az ügyeletes műveleti vezető, **Nagy Katalin** (szerepkör: *Műveleti vezető*) megnyitja a rendszert, hogy elindítsa a kitelepítés informatikai támogatását. Bejelentkezéskor a jelszava után egy 6 jegyű, e-mailben kiküldött kódot is meg kell adnia (kétfaktoros hitelesítés) — csak ez után jut be a felületre.

---

## 1. lépés — Az esemény létrehozása (Rendszergazda / Műveleti vezető)

Katalin bejelentkezik, majd az **Események** listán létrehoz egy új eseményt:

- **Kód:** `ARVIZ-2026-03`
- **Név:** "2026. márciusi árvízi kitelepítés – Mosoni-Duna"
- **Státusz:** *Tervezet* (még nem indult el a tényleges kitelepítés)

Az esemény szerkesztő dialógusban hozzárendeli a rendelkezésre álló befogadóhelyeket, mindegyikhez egyedi kapacitás-korláttal:

| Befogadóhely | Kapacitás ehhez az eseményhez |
|---|---|
| Győri Városi Sportcsarnok | 150 fő |
| Mosonmagyaróvári Iskola Tornaterem | 80 fő |
| Kapuvári Művelődési Ház | 60 fő |

Amint minden elő van készítve, Katalin átállítja az esemény státuszát **Aktívra** — ettől a pillanattól kezdve a regisztrátorok és a befogadóhelyi kezelők is dolgozhatnak vele.

## 2. lépés — Lakossági előzetes tájékoztatás és önkiszolgáló regisztráció

Mivel a veszélyhelyzet 24 órával a tényleges kitelepítés előtt ismertté vált, van idő arra, hogy a lakosság **előre, otthonról regisztráljon**. Katalin az esemény dashboardján megtalálja és a helyi önkormányzatokkal, illetve a megyei Facebook-oldalon megosztja az önkiszolgáló előregisztrációs linket:

```
https://kitelepites.gyms-katved.hu/onkiszolgalo/ARVIZ-2026-03
```

Egy érintett lakos, **Kovács Béláné** (Vámosszabadi) a linken keresztül, bejelentkezés nélkül kitölti saját és két gyermeke adatait, jelzi, hogy nincs saját járműve (tehát központi szállítást igényel), és hogy kisebbik gyermeke ágyhoz kötött nagyanyjukkal egy háztartásban élnek — ezt egyedi igényként (mozgás-/érzékszervi korlátozottság kategóriában, "Ágyhoz kötött" típussal) rögzíti. A regisztráció végén a rendszer digitális QR-kódot állít elő, amit Kovácsné a telefonjára ment, illetve igény esetén ki is nyomtathat.

## 3. lépés — Helyszíni regisztráció a gyülekezőponton

**2026. március 15., szombat, 06:00.** A kitelepítés ténylegesen megkezdődik. A vámosszabadi művelődési háznál kijelölt gyülekezőponton **Tóth Eszter** regisztrátor QR-kód-olvasóval felszerelt tabletet használ.

Aki már előzetesen regisztrált (mint Kovácsné), annak elég a QR-kódját felmutatnia — Eszter a **QR érkeztetés** felületen beolvassa, és a rendszer megjeleníti a már rögzített adatokat (beleértve az ágyhoz kötött nagyanya egyedi igényét is, jól látható figyelmeztető ikonnal).

Aki még nem regisztrált, azt Eszter a **Regisztrációs varázsló** oldalon veszi fel helyben: név, születési adatok, cím (a település mezőben immár kereshető legördülőből választva), telefonszám, család hozzárendelése (pl. egy 4 fős család egy csoportként, közös családkóddal), egyedi igények rögzítése. A regisztráció végén azonnal QR-kódot állít ki a személynek.

Egy család esetén — **Szabó család**, 5 fő — Eszter észreveszi, hogy a nagypapa gyógyszeres kezelés alatt áll (rendszeres, létfontosságú gyógyszerszedés). Ezt egészségügyi kategóriájú egyedi igényként rögzíti, ami később a napi készletigény-előrejelzésben (gyógyszerre szorulók száma) és a befogadóhelyi kezelő számára is látható lesz.

## 4. lépés — Szállítás központi busszal

Mivel Kovácsné családjának nincs saját járműve, központi szállítást igényelt. A műveleti vezető már korábban felvett egy szállítóeszközt:

- **Megnevezés:** "1. sz. busz – Győr"
- **Kapacitás:** 50 fő
- **Kísérő:** Varga Attila (katasztrófavédelmi önkéntes)
- **Indulási pont:** Vámosszabadi gyülekezőpont
- **Célállomás:** Győri Városi Sportcsarnok

A gyülekezőponton Eszter (vagy a kísérő, ha neki is van hozzáférése) a **Szállítás nyomon követése** oldalon, a busz kiválasztása után QR-kóddal rögzíti a felszállókat. A busz indulásakor a rendszeren látszik: "26 / 50 fő a fedélzeten". Útközben a kísérő a "Pozíció szimulálása" gombbal frissíti a busz (szimulált) helyzetét, ami a térképes áttekintésen valós időben követhető.

## 5. lépés — Érkeztetés a befogadóhelyen

A Győri Városi Sportcsarnokban **Kiss Márton** befogadóhelyi kezelő fogadja az érkezőket. Amikor a busz megérkezik, a kísérő a **Leszállás rögzítése** gombbal jelzi az utasok leszállását, majd Márton egyenként (vagy a busz utaslistájából kattintva) beolvassa a QR-kódokat, és minden személyt ágyhoz rendel a saját befogadóhelyén.

Amikor Kovácsné QR-kódját beolvassa, a rendszer figyelmeztető ikonnal jelzi az ágyhoz kötött nagyanya egyedi igényét — Márton ez alapján gondoskodik földszinti, könnyen megközelíthető ágyról.

## 6. lépés — Egy szétszakadt család és a családegyesítés

Sajnos a Szabó család két tagja (a nagypapa és az egyik unoka) egy másik buszra keveredett, és végül a Mosonmagyaróvári Iskola Tornatermében kötöttek ki, míg a család többi tagja Győrben van.

A rendszer ezt **automatikusan észreveszi**: amikor a nagypapát a mosonmagyaróvári befogadóhelyen érkeztetik, a check-in választ egy figyelmeztetés kíséri ("Figyelem: a család más tagjai jelenleg más befogadóhelyen tartózkodnak"), amit a befogadóhelyi kezelő azonnal lát.

Katalin (műveleti vezető) a **Családegyesítési munkalistán** megtalálja a Szabó családot a szétszakadt családok között. A kártyát lenyitva egy térképet is lát arról, hogy jelenleg hol tartózkodnak a család tagjai (Győr és Mosonmagyaróvár), és rögzít egy ügyintézési bejegyzést: "Átszállítás szervezés alatt a nagypapa gyógyszeres kezelése miatt priorizálva." Másnap, miután megoldották az átszállítást, a bejegyzést megoldottként jelöli.

## 7. lépés — Egy rendkívüli esemény (incidens)

Vasárnap délután a Győri Városi Sportcsarnokban két család között vitás helyzet alakul ki egy közös helyiség használata miatt. Márton (befogadóhelyi kezelő) rögzíti az esetet a **Rendkívüli események** oldalon: kategória "konfliktus", súlyosság "közepes", rövid leírással. Ahogy elmenti, Katalin — aki épp a szállítás nyomon követése oldalt nézi otthonról — azonnal, frissítés nélkül egy figyelmeztető toast-üzenetet kap az incidensről (a rendszer a bejelentkezett, jogosult felhasználóknak élőben, WebSocketen küldi ki az értesítést). Miután a helyzetet a helyszínen rendezik, Márton az esetet megoldottként zárja le, a megoldás időpontjával és rögzítő nevével együtt visszakereshetően.

## 8. lépés — A helyzet nyomon követése (Műveleti vezető)

Katalin a hétvége alatt folyamatosan az **Esemény dashboardot** figyeli — a befogadóhelyi kapacitás- és kockázat-táblázat élőben, WebSocketen frissül minden érkeztetéskor/áthelyezéskor, neki nem kell manuálisan frissítenie az oldalt:

- **Regisztráltak:** 187 fő, **Családok:** 52
- **Megérkezettek:** 171 fő
- **Központi szállítást igénylők:** 34 fő
- **Hiányzók:** 2 fő (ez azonnal kattintható, szűrt listát ad — Katalin rögtön intézkedik, hogy ellenőrizzék, hol lehetnek)
- **Befogadóhelyi kapacitások táblázat**: a Győri Városi Sportcsarnok 132/150 fő, telítettség 88%, kockázati szint "Magas" — Katalin ez alapján dönt úgy, hogy az új érkezőket inkább a Kapuvári Művelődési Házba irányítsák.
- **Napi készletigény-előrejelzés**: 187 fő × 3 étkezés = 561 adag/nap, ebből 12 speciális diétás, 9 fő gyógyszerre szoruló — ezt az adatot azonnal továbbítja az ellátásért felelős logisztikai csoportnak, a "Gyógyszerre szoruló" mutatóra kattintva pedig meg is nyílik a pontos névsor, hogy a helyi gyógyszertárral egyeztetni lehessen.

## 9. lépés — Nyomtatott névsor a helyszíni ellátáshoz

A Győri Városi Sportcsarnokban dolgozó egészségügyi önkéntesek papíralapú névsort kérnek a jelenleg ott tartózkodókról. Márton a **Befogadóhelyek** oldalon a sportcsarnok sorában megnyitja a nyomtatható névsort, ami rendezett, olvasható formátumban (név, születési adat, település, telefon, család, egyedi igény) listázza az ott tartózkodókat, majd a böngésző "Nyomtatás" funkciójával kinyomtatja (vagy PDF-be menti).

## 10. lépés — A visszatelepítés megkezdése

**2026. március 18., szerda.** A vízállás visszahúzódik, a közműszolgáltatók és a közútkezelő megerősítik, hogy Vámosszabadi biztonságosan visszatelepíthető, Vének esetében viszont még feltételekhez kötött (útburkolat-ellenőrzés van folyamatban), Kisbajcs esetében pedig még nem engedélyezett a visszatérés.

Katalin a **Visszatelepítés** oldalon rögzíti ezt településenként:

| Település | Státusz | Megjegyzés |
|---|---|---|
| Vámosszabadi | Engedélyezett | — |
| Vének | Feltételes | "Útburkolat-ellenőrzés folyamatban, csak nappal ajánlott a közlekedés." |
| Kisbajcs | Nem engedélyezett | "Ivóvízhálózat fertőtlenítése még zajlik." |

A vámosszabadi lakosok a rendszerben (vagy a helyszínen a regisztrátornál) hazatérésüket megerősíthetik, amit a rendszer "Hazatért" státuszra vált, és a visszatelepítési oldal élőben mutatja, hány fő tért már haza az adott településről.

## 11. lépés — Utólagos elszámolás és lezárás

A kitelepítés végeztével Katalin exportálja az **összesítő jelentést** (CSV), amely tartalmazza a regisztráltak, családok, állapot- és igény-eloszlás, valamint a befogadóhelyi kihasználtság összesített adatait — ezt csatolja a katasztrófavédelmi utóértékelő jelentéshez.

Egy auditor (**Dr. Farkas Judit**, belső ellenőr) a **Műveleti napló** oldalon visszaellenőrzi az eseményt: megnézi, ki mikor módosított státuszt, ki adott ki pótlólagos QR-kódot elveszett kód miatt, és hogy minden törlés/módosítás indokolt volt-e. Az ő nézetében a személyes adatok (telefonszám, cím) maszkolva jelennek meg — csak a folyamat auditálásához szükséges információt látja.

Végül Katalin az esemény státuszát **Lezártra** állítja. A hozzá tartozó személyes adatok a jogszabályi megőrzési idő lejártával a rendszer automatikus, napi ütemezett feladata törli — ezt is naplózva.

---

## Összefoglalva: ki mit használt ebben a forgatókönyvben?

| Szereplő | Szerepkör | Fő tevékenységek |
|---|---|---|
| Nagy Katalin | Műveleti vezető | Esemény létrehozása/lezárása, dashboard monitorozás, családegyesítés felügyelete, visszatelepítés engedélyezése, jelentés export |
| Tóth Eszter | Regisztrátor | Helyszíni regisztráció, QR-kód kiadás, érkeztetés a gyülekezőponton |
| Kiss Márton | Befogadóhelyi kezelő | QR-érkeztetés a befogadóhelyen, ágyhoz rendelés, incidens rögzítése, névsor nyomtatása |
| Varga Attila | (kísérő, regisztrátor jogosultsággal) | Utasok fel-/leszállásának rögzítése, pozíció szimulálása |
| Kovács Béláné | Lakosság (nincs bejelentkezés) | Önkiszolgáló előregisztráció, saját profil kezelése |
| Dr. Farkas Judit | Auditor | Utólagos naplóellenőrzés, maszkolt adatnézet |

Ez a forgatókönyv a rendszer szinte minden fő modulját érintette: eseménykezelés, regisztráció (mindkét csatornán), QR-azonosítás, befogadóhely- és szállítás-kezelés, családegyesítés, incidenskezelés, dashboard/jelentés, visszatelepítés és auditnapló — pontosan azt a folyamatot digitalizálva, amit egy valós kitelepítés során a katasztrófavédelemnek kézi/papíralapú eszközökkel jóval nehezebb lenne koordinálnia.
