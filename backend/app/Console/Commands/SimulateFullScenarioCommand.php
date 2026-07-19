<?php

namespace App\Console\Commands;

use App\Actions\Qr\IssueQrTokenAction;
use App\Actions\Registrations\CreateRegistrationAction;
use App\Actions\Registrations\UpdateRegistrationStatusAction;
use App\Actions\Shelters\CheckInPersonAction;
use App\Actions\Shelters\TransferPersonAction;
use App\Enums\RegistrationChannel;
use App\Enums\RegistrationStatus;
use App\Enums\RoleCode;
use App\Events\IncidentCreated;
use App\Events\TransportPositionUpdated;
use App\Exceptions\AlreadyCheckedInException;
use App\Exceptions\ShelterFullException;
use App\Models\AuditLog;
use App\Models\EvacuationEvent;
use App\Models\EventShelter;
use App\Models\Family;
use App\Models\FamilyReunificationNote;
use App\Models\Incident;
use App\Models\Municipality;
use App\Models\Person;
use App\Models\RepatriationAuthorization;
use App\Models\Shelter;
use App\Models\Transport;
use App\Models\TransportManifestEntry;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Console\Command;

/**
 * Bemutató/fejlesztői segédeszköz: alapból EGY (--events-szel több is
 * lehet) új eseményt hoz létre a semmiből, kb. 300 fős (Faker hu_HU-val
 * generált) népességgel, családokkal, önkiszolgáló és helyszíni
 * regisztrációval, szállítással, szándékos családszétválással és
 * -egyesítéssel, incidenssel, visszatelepítéssel — ez a "gyors, tömeges
 * feltöltés" fázis, sleep nélkül, a SyntheticRegistrationSeeder mintájára.
 * Utána egy hosszabb, ténylegesen ÉLŐ tempójú záró szakasz következik, ami
 * a létrehozott esemény(ek) között véletlenszerűen érkeztet/áthelyez/
 * incidenst jelent/pozíciót szimulál, hogy böngészőben ténylegesen
 * követhető legyen. A végén önellenőrző riport.
 *
 * NEM éles/demonstrációs adatra szánt eszköz — csak fejlesztői célra.
 */
class SimulateFullScenarioCommand extends Command
{
    protected $signature = 'demo:full-scenario
        {--events=1 : Hány új esemény jöjjön létre}
        {--people=300 : Célpopuláció eseményenként (nagyságrendileg)}
        {--interval=2 : Másodperc két élő lépés között a záró szakaszban}
        {--live-actions=40 : Hány élő akció fusson le a tömeges feltöltés után}';

    protected $description = 'Egy (vagy --events-szel több) eseményt hoz létre kb. 100 fős népességgel, majd élő tempójú záró szakaszt és önellenőrző riportot ad';

    private const SPECIAL_NEED_TYPES = [
        'medical' => ['diabetes', 'heart_disease', 'respiratory', 'regular_medication'],
        'mobility' => ['wheelchair', 'walking_aid', 'bedridden'],
        'age' => ['infant', 'pregnant', 'elderly'],
        'diet' => ['gluten_free', 'diabetic_diet', 'vegetarian'],
        'animal' => ['dog', 'cat'],
        'other' => ['language_barrier', 'unaccompanied_minor'],
    ];

    private const SCENARIO_NAMES = [
        'Árvízi kitelepítés', 'Ipari baleset miatti kitelepítés', 'Tűzeset miatti kitelepítés',
        'Vegyi szennyeződés miatti kitelepítés', 'Széllökés/viharkár miatti kitelepítés',
    ];

    private const INCIDENT_DESCRIPTIONS = [
        'complaint' => ['Panasz érkezett az étkeztetés minőségére.', 'Panasz a mosdók tisztaságával kapcsolatban.'],
        'conflict' => ['Vita alakult ki két család között a szálláshelyek beosztása miatt.', 'Hangos szóváltás a közösségi térben.'],
        'security' => ['Illetéktelen személy próbált bejutni a befogadóhelyre.', 'Elveszett értéktárgy bejelentése.'],
        'damage' => ['Vízvezeték-törés az egyik szálláshelyiségben.', 'Megrongálódott bútorzat a közösségi térben.'],
        'other' => ['Sürgős gyógyszerutánpótlás igénye merült fel.', 'Kisállat elszökött a befogadóhely területén.'],
    ];

    /** @var array<int, array{0: bool, 1: string}> */
    private array $checks = [];

    private \Faker\Generator $faker;

    private User $operator;

    private User $registrar;

    private User $system;

    public function handle(
        CreateRegistrationAction $createRegistration,
        IssueQrTokenAction $issueQr,
        CheckInPersonAction $checkIn,
        TransferPersonAction $transfer,
        UpdateRegistrationStatusAction $updateStatus,
        AuditService $auditService,
    ): int {
        $this->operator = User::whereHas('role', fn ($q) => $q->where('code', RoleCode::Admin->value))->first();
        $this->registrar = User::whereHas('role', fn ($q) => $q->where('code', RoleCode::Registrar->value))->first() ?? $this->operator;
        $this->system = User::system();

        if (! $this->operator) {
            $this->error('Nincs admin szerepkörű felhasználó — fusson le előbb a UserSeeder.');

            return self::FAILURE;
        }

        $this->faker = \Faker\Factory::create('hu_HU');
        $eventCount = max(1, (int) $this->option('events'));
        $targetPeople = max(6, (int) $this->option('people'));
        $interval = max(1, (int) $this->option('interval'));
        $liveActions = max(0, (int) $this->option('live-actions'));

        $shelterPool = $this->shelterPool();

        // --- Gyors, tömeges feltöltési fázis (sleep nélkül) ---
        $this->line("<comment>=== Tömeges feltöltés: {$eventCount} esemény, kb. {$targetPeople} fő/esemény ===</comment>");
        $events = [];
        for ($i = 1; $i <= $eventCount; $i++) {
            $events[] = $this->setupEvent(
                $i, $shelterPool, $targetPeople,
                $createRegistration, $issueQr, $checkIn, $transfer, $updateStatus, $auditService,
            );
        }

        // --- Élő záró szakasz (valódi tempóval) ---
        $this->newLine();
        $this->line("<comment>=== Élő záró szakasz: {$liveActions} akció, {$interval}s-enként, a(z) {$eventCount} esemény között váltogatva ===</comment>");
        for ($i = 0; $i < $liveActions; $i++) {
            /** @var array $scenario */
            $scenario = $this->faker->randomElement($events);
            $this->performLiveAction($scenario, $checkIn, $transfer, $updateStatus, $auditService);
            sleep($interval);
        }

        // --- Önellenőrző riport ---
        $this->finalReport($events);

        return self::SUCCESS;
    }

    /**
     * Néhány, koordinátával rendelkező fizikai befogadóhelyet hoz létre
     * (vagy használ fel újra `firstOrCreate`-tel) — ugyanazok a fizikai
     * helyek több eseményhez is hozzárendelhetők, eltérő kapacitással,
     * ahogy azt a README is leírja ("Architektúra" / 1. Események).
     *
     * @return array<int, Shelter>
     */
    private function shelterPool(): array
    {
        $towns = [
            ['name' => 'Demó Győr', 'postal_code' => '9024', 'lat' => 47.6875, 'lng' => 17.6504],
            ['name' => 'Demó Mosonmagyaróvár', 'postal_code' => '9200', 'lat' => 47.8641, 'lng' => 17.2686],
            ['name' => 'Demó Csorna', 'postal_code' => '9300', 'lat' => 47.6167, 'lng' => 17.2500],
            ['name' => 'Demó Kapuvár', 'postal_code' => '9330', 'lat' => 47.5942, 'lng' => 17.0292],
        ];

        return collect($towns)->map(function (array $town, int $i) {
            $municipality = Municipality::firstOrCreate(
                ['name' => $town['name']],
                ['county' => 'Győr-Moson-Sopron', 'postal_code' => $town['postal_code'], 'lat' => $town['lat'], 'lng' => $town['lng']]
            );

            return Shelter::firstOrCreate(
                ['name' => "Demó befogadóhely #{$i}0 ({$town['name']})"],
                ['municipality_id' => $municipality->id, 'address' => 'Demó utca '.($i + 1).'.', 'capacity_total' => 200]
            );
        })->all();
    }

    /**
     * Egy teljes esemény gyors, sleep nélküli felépítése: létrehozás,
     * aktiválás, kb. $targetPeople fős népesség (családok + önkiszolgáló
     * egyének, Faker hu_HU adatokkal), szállítás, kezdeti foglaltság,
     * garantált családszétválás+egyesítés, incidens, visszatelepítés.
     *
     * @param array<int, Shelter> $shelterPool
     * @return array{event: EvacuationEvent, shelters: array<int, EventShelter>, registeredPersonIds: array<int, string>}
     */
    private function setupEvent(
        int $index,
        array $shelterPool,
        int $targetPeople,
        CreateRegistrationAction $createRegistration,
        IssueQrTokenAction $issueQr,
        CheckInPersonAction $checkIn,
        TransferPersonAction $transfer,
        UpdateRegistrationStatusAction $updateStatus,
        AuditService $auditService,
    ): array {
        $code = 'DEMO-'.now()->format('YmdHis')."-{$index}";
        $name = $this->faker->randomElement(self::SCENARIO_NAMES).' – '.now()->format('Y.m.d.')." #{$index}";

        $event = EvacuationEvent::create(['code' => $code, 'name' => $name, 'status' => 'draft']);
        $auditService->log('create', $event, $this->operator, null, $event->toArray());
        $event->update(['status' => 'active']);

        // Két-három befogadóhely a közös törzsadat-poolból, eseményenként
        // eltérő kapacitás-korláttal.
        $chosenShelters = collect($shelterPool)->shuffle()->take($this->faker->numberBetween(2, 3));
        $eventShelters = $chosenShelters->map(fn (Shelter $shelter) => EventShelter::create([
            'event_id' => $event->id,
            'shelter_id' => $shelter->id,
            'capacity_limit' => $this->faker->numberBetween(60, 120),
        ]))->all();

        // --- Népesség: családok (helyszíni csatorna) + egyének (önkiszolgáló) ---
        $residentMunicipality = Municipality::firstOrCreate(
            ['name' => "Demó lakóhely #{$index}"],
            ['county' => 'Győr-Moson-Sopron', 'postal_code' => (string) $this->faker->numberBetween(9000, 9499)]
        );

        $persons = [];
        $familyMembersByFamily = [];

        $selfServiceTarget = (int) round($targetPeople * 0.15);
        for ($i = 0; $i < $selfServiceTarget; $i++) {
            $person = $createRegistration->execute(
                $event,
                $this->personData($residentMunicipality, $this->faker->boolean(20)),
                $this->system,
                RegistrationChannel::SelfService,
            );
            $issueQr->execute($person, $this->system);
            $persons[] = $person;
        }

        $familyTarget = $targetPeople - $selfServiceTarget;
        $generatedFamilyPeople = 0;
        while ($generatedFamilyPeople < $familyTarget) {
            $familySize = $this->faker->numberBetween(1, 5);
            $familyId = null;
            $sharedLastName = $this->faker->lastName();

            $familyPersons = [];
            for ($m = 0; $m < $familySize && $generatedFamilyPeople < $familyTarget; $m++) {
                $data = $this->personData($residentMunicipality, $this->faker->boolean(20));
                $data['last_name'] = $sharedLastName;
                if ($familySize > 1 && $m === 0) {
                    $data['create_new_family'] = true;
                    $data['is_primary_contact'] = true;
                } elseif ($familyId) {
                    $data['family_id'] = $familyId;
                }

                $person = $createRegistration->execute($event, $data, $this->registrar);
                if ($familySize > 1 && $m === 0) {
                    $familyId = $person->family_id;
                }
                $issueQr->execute($person, $this->registrar);

                $persons[] = $person;
                $familyPersons[] = $person;
                $generatedFamilyPeople++;
            }

            if ($familyId) {
                $familyMembersByFamily[$familyId] = $familyPersons;
            }
        }

        // --- Szállítás ---
        $transports = collect(['1. sz. busz', '2. sz. busz', 'Vasúti szerelvény'])
            ->map(fn ($label) => Transport::create(['event_id' => $event->id, 'code' => "{$label} – {$name}", 'capacity' => $this->faker->numberBetween(40, 120)]))
            ->all();
        foreach ($transports as $transport) {
            $eventShelterWithCoords = collect($eventShelters)->first(fn (EventShelter $es) => $es->shelter?->municipality?->lat !== null);
            if ($eventShelterWithCoords) {
                $this->simulatePosition($transport, $eventShelterWithCoords->shelter->municipality);
            }
        }

        // --- Garantált családszétválás + egyesítés (ha van legalább 2 fős család) ---
        // Szándékosan a tömeges kezdeti foglaltság ELŐTT fut, és a család
        // MINDEN tagját kizárjuk az utána következő véletlenszerű
        // érkeztetési körből — nem csak a ténylegesen szétválasztott 2 főt.
        // Enélkül a család többi tagja a véletlenszerű bulk-érkeztetéskor
        // egy harmadik befogadóhelyre kerülhetett volna, és a család
        // "újra egyesítve" ellenőrzés soha nem teljesült volna, hiába lett
        // a két kiválasztott tag ténylegesen egy helyre áthelyezve.
        $splitFamily = collect($familyMembersByFamily)->first(fn ($members) => count($members) >= 2);
        $familyIdForCheck = null;
        $splitParticipantIds = [];
        if ($splitFamily && count($eventShelters) >= 2) {
            $familyIdForCheck = $splitFamily[0]->family_id;
            $splitParticipantIds = collect($splitFamily)->pluck('id')->all();
            [$shelterX, $shelterY] = [$eventShelters[0]->shelter, $eventShelters[1]->shelter];

            try {
                // Az első tag a "Y" befogadóhelyre kerül (szétválás), a
                // család többi tagja rögtön az "X" befogadóhelyre — így
                // pontosan egy fő lesz a szétvált, a többi már eleve együtt van.
                $checkIn->execute($event, $splitFamily[0], $shelterY, $this->operator);
                foreach (array_slice($splitFamily, 1) as $otherMember) {
                    $checkIn->execute($event, $otherMember, $shelterX, $this->operator);
                }

                FamilyReunificationNote::create([
                    'family_id' => $familyIdForCheck, 'note' => 'Átszállítás szervezés alatt.',
                    'resolved' => false, 'created_by' => $this->registrar->id,
                ]);

                $transfer->execute($splitFamily[0]->fresh(), $shelterX, $this->operator);

                FamilyReunificationNote::create([
                    'family_id' => $familyIdForCheck, 'note' => 'Átszállítás megtörtént, a család újra együtt.',
                    'resolved' => true, 'created_by' => $this->registrar->id,
                ]);
            } catch (ShelterFullException|AlreadyCheckedInException) {
                $familyIdForCheck = null;
            }
        }

        // --- Kezdeti foglaltság: kb. fele érkeztetve, ötöde szállítás alatt, többi regisztrált ---
        $shuffled = collect($persons)->reject(fn (Person $p) => in_array($p->id, $splitParticipantIds, true))->shuffle();
        $toCheckIn = $shuffled->take((int) round($shuffled->count() * 0.5));
        $remaining = $shuffled->skip($toCheckIn->count());
        $toBoardOnly = $remaining->take((int) round($shuffled->count() * 0.2));

        foreach ($toCheckIn as $person) {
            $eventShelter = $this->faker->randomElement($eventShelters);
            if ($eventShelter->checked_in_count >= $eventShelter->capacity_limit) {
                continue;
            }
            try {
                $checkIn->execute($event, $person, $eventShelter->shelter, $this->operator);
            } catch (ShelterFullException|AlreadyCheckedInException) {
                // Szintetikus adatnál egyszerűen kimarad — nem kritikus.
            }
        }

        foreach ($toBoardOnly as $person) {
            $transport = $this->faker->randomElement($transports);
            TransportManifestEntry::create([
                'transport_id' => $transport->id, 'event_id' => $event->id, 'person_id' => $person->id,
                'boarded_at' => now(), 'boarded_by' => $this->registrar->id,
            ]);
            if ($person->registration) {
                $updateStatus->execute($person->registration()->first(), RegistrationStatus::InTransport, $this->registrar);
            }
        }

        // --- Garantált incidens ---
        $incidentShelter = $this->faker->randomElement($eventShelters)->shelter;
        $category = $this->faker->randomElement(array_keys(self::INCIDENT_DESCRIPTIONS));
        $incident = Incident::create([
            'event_id' => $event->id, 'shelter_id' => $incidentShelter->id,
            'category' => $category, 'severity' => $this->faker->randomElement(['low', 'medium', 'high']),
            'description' => $this->faker->randomElement(self::INCIDENT_DESCRIPTIONS[$category]),
            'status' => 'open', 'reported_by' => $this->operator->id,
        ]);
        event(new IncidentCreated($incident->load('shelter')));
        $incident->update(['status' => 'resolved', 'resolved_at' => now(), 'resolved_by' => $this->operator->id]);

        // --- Garantált visszatelepítés egy önkiszolgáló személynek ---
        $repatriated = null;
        $selfServicePerson = collect($persons)->first(fn (Person $p) => $p->registration?->channel?->value === 'self_service');
        if ($selfServicePerson) {
            RepatriationAuthorization::updateOrCreate(
                ['event_id' => $event->id, 'municipality_id' => $selfServicePerson->municipality_id],
                ['status' => 'permitted', 'updated_by' => $this->operator->id]
            );
            $registration = $selfServicePerson->registration()->first();
            if ($registration) {
                $updateStatus->execute($registration, RegistrationStatus::ReturnedHome, $this->system);
                $auditService->log('self_return_confirmed', $registration, $this->system, null, ['status' => RegistrationStatus::ReturnedHome->value]);
                $repatriated = $selfServicePerson->id;
            }
        }

        $familiesCount = Family::where('event_id', $event->id)->count();
        $this->line(sprintf(
            '  <info>%s</info> (%s): %d fő, %d család, %d befogadóhely, %d szállítóeszköz — incidens+visszatelepítés+%s',
            $event->code,
            $event->name,
            count($persons),
            $familiesCount,
            count($eventShelters),
            count($transports),
            $familyIdForCheck ? 'családegyesítés OK' : 'családegyesítés kihagyva (nem volt megfelelő család)',
        ));

        return [
            'event' => $event,
            'shelters' => $eventShelters,
            'transports' => $transports,
            'totalPersons' => count($persons),
            'splitFamilyId' => $familyIdForCheck,
            'repatriatedPersonId' => $repatriated,
        ];
    }

    /**
     * Egyetlen véletlenszerű, látható akciót hajt végre egy adott
     * esemény kontextusában az élő záró szakaszban — ugyanaz az
     * akció-választék, mint a `demo:simulate-activity`-ban, csak több
     * esemény között váltogatva.
     */
    private function performLiveAction(
        array $scenario,
        CheckInPersonAction $checkIn,
        TransferPersonAction $transfer,
        UpdateRegistrationStatusAction $updateStatus,
        AuditService $auditService,
    ): void {
        /** @var EvacuationEvent $event */
        $event = $scenario['event'];
        $prefix = "[{$event->code}]";
        $roll = $this->faker->numberBetween(1, 100);

        try {
            if ($roll <= 45) {
                $registration = $event->registrations()->where('status', RegistrationStatus::Registered->value)->inRandomOrder()->first();
                $eventShelter = collect($scenario['shelters'])->first(fn (EventShelter $es) => $es->fresh()->checked_in_count < $es->capacity_limit);
                if ($registration && $eventShelter) {
                    $checkIn->execute($event, $registration->person, $eventShelter->shelter, $this->operator);
                    $this->line("  {$prefix} <info>Érkeztetve:</info> {$registration->person->fullName()} → {$eventShelter->shelter->name}");
                } else {
                    $this->line("  {$prefix} <comment>Kihagyva</comment> (nincs várakozó személy vagy szabad hely)");
                }
            } elseif ($roll <= 65) {
                $registration = $event->registrations()->where('status', RegistrationStatus::ArrivedShelter->value)->inRandomOrder()->first();
                if ($registration) {
                    $currentShelterId = $registration->person->checkins()->latest('checked_in_at')->first()?->shelter_id;
                    $eventShelter = collect($scenario['shelters'])->first(fn (EventShelter $es) => $es->shelter_id !== $currentShelterId && $es->fresh()->checked_in_count < $es->capacity_limit);
                    if ($eventShelter) {
                        $transfer->execute($registration->person, $eventShelter->shelter, $this->operator);
                        $this->line("  {$prefix} <info>Áthelyezve:</info> {$registration->person->fullName()} → {$eventShelter->shelter->name}");
                    } else {
                        $this->line("  {$prefix} <comment>Kihagyva</comment> (nincs másik szabad befogadóhely)");
                    }
                } else {
                    $this->line("  {$prefix} <comment>Kihagyva</comment> (nincs érkezett személy áthelyezéshez)");
                }
            } elseif ($roll <= 85) {
                $transport = $this->faker->randomElement($scenario['transports']);
                $municipality = collect($scenario['shelters'])->first()->shelter->municipality;
                $this->simulatePosition($transport, $municipality);
                $this->line("  {$prefix} <info>Pozíció frissítve:</info> {$transport->code}");
            } else {
                $eventShelter = $this->faker->randomElement($scenario['shelters']);
                $category = $this->faker->randomElement(array_keys(self::INCIDENT_DESCRIPTIONS));
                $incident = Incident::create([
                    'event_id' => $event->id, 'shelter_id' => $eventShelter->shelter_id,
                    'category' => $category, 'severity' => $this->faker->randomElement(['low', 'medium', 'high']),
                    'description' => $this->faker->randomElement(self::INCIDENT_DESCRIPTIONS[$category]),
                    'status' => 'open', 'reported_by' => $this->operator->id,
                ]);
                event(new IncidentCreated($incident->load('shelter')));
                $this->line("  {$prefix} <error>Incidens:</error> {$category} — {$eventShelter->shelter->name}");
            }
        } catch (ShelterFullException|AlreadyCheckedInException $e) {
            $this->line("  {$prefix} <comment>Kihagyva:</comment> {$e->getMessage()}");
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function personData(Municipality $municipality, bool $withSpecialNeed): array
    {
        $genderRoll = $this->faker->numberBetween(1, 100);
        $gender = $genderRoll <= 48 ? 'male' : ($genderRoll <= 96 ? 'female' : 'other');

        $data = [
            'last_name' => $this->faker->lastName(),
            'first_name' => $this->faker->firstName($gender === 'other' ? null : $gender),
            'municipality_id' => $municipality->id,
            'gender' => $gender,
            'birth_place' => $this->faker->city(),
            'birth_date' => $this->faker->dateTimeBetween('-85 years', '-1 years')->format('Y-m-d'),
            'id_document_number' => strtoupper($this->faker->bothify('######??')),
            'mother_birth_name' => $this->faker->name('female'),
            'address_postal_code' => $municipality->postal_code,
            'address_settlement' => $municipality->name,
            'address_street' => $this->faker->streetName(),
            'address_house_number' => (string) $this->faker->numberBetween(1, 99),
            'phone' => $this->faker->phoneNumber(),
            'email' => $this->faker->safeEmail(),
            'central_transport_required' => $this->faker->boolean(20),
        ];

        if ($withSpecialNeed) {
            $category = $this->faker->randomElement(array_keys(self::SPECIAL_NEED_TYPES));
            $data['special_needs'] = [[
                'category' => $category,
                'type' => $this->faker->randomElement(self::SPECIAL_NEED_TYPES[$category]),
                'priority' => $this->faker->numberBetween(1, 5),
            ]];
        }

        return $data;
    }

    private function simulatePosition(Transport $transport, Municipality $municipality): void
    {
        if ($municipality->lat === null || $municipality->lng === null) {
            return;
        }
        $jitter = fn () => mt_rand(-600, 600) / 100000;
        $transport->update([
            'last_lat' => (float) $municipality->lat + $jitter(),
            'last_lng' => (float) $municipality->lng + $jitter(),
            'last_position_at' => now(),
        ]);
        event(new TransportPositionUpdated($transport->fresh()));
    }

    private function check(bool $ok, string $label): void
    {
        $this->checks[] = [$ok, $label];
    }

    /**
     * @param array<int, array> $scenarios
     */
    private function finalReport(array $scenarios): void
    {
        foreach ($scenarios as $scenario) {
            /** @var EvacuationEvent $event */
            $event = $scenario['event']->fresh();
            $registeredCount = $event->registrations()->count();
            $familiesCount = $event->families()->count();
            $auditLogCount = AuditLog::where('event_id', $event->id)->count();
            $overCapacity = collect($scenario['shelters'])->filter(fn (EventShelter $es) => $es->fresh()->checked_in_count > $es->capacity_limit);

            $this->check($registeredCount === $scenario['totalPersons'], "[{$event->code}] regisztráltak száma ({$registeredCount}) egyezik a generált személyekével ({$scenario['totalPersons']})");
            $this->check($familiesCount > 0, "[{$event->code}] legalább 1 család jött létre ({$familiesCount})");
            $this->check($overCapacity->isEmpty(), "[{$event->code}] egyik befogadóhely sincs túltöltve");
            $this->check($auditLogCount > 0, "[{$event->code}] legalább 1 auditnapló-bejegyzés létezik ({$auditLogCount} db)");
            if ($scenario['splitFamilyId']) {
                $worklist = $this->reunificationWorklistFamilyIds($event);
                $this->check(! in_array($scenario['splitFamilyId'], $worklist, true), "[{$event->code}] a szándékosan szétválasztott család újra egyesítve (nem szerepel a munkalistán)");
            }
            if ($scenario['repatriatedPersonId']) {
                $person = Person::find($scenario['repatriatedPersonId']);
                $this->check($person?->registration?->status === RegistrationStatus::ReturnedHome, "[{$event->code}] a visszatelepített személy állapota \"returned_home\"");
            }
        }

        // Regressziós ellenőrzés a korábban javított hibára: EBBEN a
        // futásban minden esemény első családja "CSAL-001" kódot kapott,
        // GLOBÁLIS ütközés nélkül (más, korábbi futásokból származó
        // eseményeket szándékosan nem számolunk bele — azoknak is lehet
        // "CSAL-001" családja, ez pont a javított viselkedés) — ha a
        // families.family_code unique constraint még mindig globális
        // lenne, ez a teljes futás korábban elszállt volna kivétellel.
        $thisRunEventIds = collect($scenarios)->map(fn ($s) => $s['event']->id)->all();
        $firstFamilyCodeCountThisRun = Family::whereIn('event_id', $thisRunEventIds)->where('family_code', 'CSAL-001')->count();
        $eventsWithAtLeastOneFamily = collect($scenarios)->filter(fn ($s) => Family::where('event_id', $s['event']->id)->exists())->count();
        $this->check($firstFamilyCodeCountThisRun === $eventsWithAtLeastOneFamily, "Nincs family_code ütközés: mind a(z) {$eventsWithAtLeastOneFamily} esemény saját, önálló \"CSAL-001\" családdal rendelkezik");

        $this->newLine();
        $this->line('<comment>=== Önellenőrző riport ===</comment>');
        $failed = 0;
        foreach ($this->checks as [$ok, $label]) {
            if ($ok) {
                $this->line("  <info>✔ OK</info>  {$label}");
            } else {
                $failed++;
                $this->line("  <error>⚠ FIGYELEM</error>  {$label}");
            }
        }

        $this->newLine();
        if ($failed === 0) {
            $this->info('Minden ellenőrzés rendben.');
        } else {
            $this->error("{$failed} ellenőrzés nem az elvárt eredményt adta — nézd meg a fenti listát.");
        }

        $this->newLine();
        $codes = collect($scenarios)->map(fn ($s) => $s['event']->code)->implode(', ');
        $this->line("A létrehozott események ({$codes}) AKTÍV állapotban maradtak, böngészőben tovább vizsgálhatók.");
    }

    /**
     * @return array<int, int|string>
     */
    private function reunificationWorklistFamilyIds(EvacuationEvent $event): array
    {
        return $event->families()
            ->with(['members.checkins' => fn ($q) => $q->orderByDesc('checked_in_at')->orderByDesc('id')])
            ->get()
            ->filter(function (Family $family) {
                $shelterIds = $family->members
                    ->map(fn ($m) => $m->checkins->first()?->shelter_id)
                    ->filter()
                    ->unique();

                return $shelterIds->count() > 1;
            })
            ->pluck('id')
            ->all();
    }
}
