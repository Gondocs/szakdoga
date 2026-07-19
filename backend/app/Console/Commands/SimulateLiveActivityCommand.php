<?php

namespace App\Console\Commands;

use App\Actions\Registrations\CreateRegistrationAction;
use App\Actions\Shelters\CheckInPersonAction;
use App\Actions\Shelters\TransferPersonAction;
use App\Enums\RegistrationStatus;
use App\Enums\RoleCode;
use App\Events\IncidentCreated;
use App\Events\TransportPositionUpdated;
use App\Exceptions\AlreadyCheckedInException;
use App\Exceptions\ShelterFullException;
use App\Models\EvacuationEvent;
use App\Models\EventShelter;
use App\Models\Incident;
use App\Models\Municipality;
use App\Models\Person;
use App\Models\Registration;
use App\Models\Transport;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Bemutató/fejlesztői segédeszköz: valós Action-osztályokon (nem
 * "kézzel piszkált" adatbázis-mezőkön) keresztül generál folyamatosan
 * érkeztetéseket, áthelyezéseket, szállítóeszköz-pozícióváltozásokat és
 * incidenseket egy eseményhez, hogy a WebSocket (Reverb) real-time
 * frissítés — dashboard kapacitás/kockázat, busz-marker mozgás,
 * incidens-toast — élőben, böngészőben megfigyelhető legyen anélkül, hogy
 * valakinek manuálisan kellene kattintgatnia a felületen.
 *
 * NEM éles/demonstrációs adatra szánt eszköz — csak fejlesztői célra.
 */
class SimulateLiveActivityCommand extends Command
{
    protected $signature = 'demo:simulate-activity
        {event=EVT-2026-001 : Az esemény kódja, amelyhez az akciók generálódnak}
        {--interval=4 : Másodperc két akció között}
        {--duration= : Opcionális időkorlát másodpercben; üresen hagyva Ctrl+C-ig fut}';

    protected $description = 'Élő érkeztetéseket/áthelyezéseket/szállítóeszköz-pozíciókat/incidenseket generál egy eseményhez a WebSocket real-time frissítés demonstrálásához';

    public function handle(
        CreateRegistrationAction $createRegistration,
        CheckInPersonAction $checkIn,
        TransferPersonAction $transfer,
    ): int {
        $event = EvacuationEvent::where('code', $this->argument('event'))->first();

        if (! $event) {
            $this->error("Nincs ilyen kódú esemény: {$this->argument('event')}. Add meg egy meglévő esemény kódját, vagy hozz létre egyet.");

            return self::FAILURE;
        }

        $operator = User::whereHas('role', fn ($q) => $q->where('code', RoleCode::Admin->value))->first();
        $registrar = User::whereHas('role', fn ($q) => $q->where('code', RoleCode::Registrar->value))->first() ?? $operator;

        if (! $operator) {
            $this->error('Nincs admin szerepkörű felhasználó — fusson le előbb a UserSeeder.');

            return self::FAILURE;
        }

        if ($event->eventShelters()->count() === 0) {
            $this->error("A(z) {$event->code} eseményhez nincs befogadóhely rendelve — előbb rendelj hozzá legalább egyet.");

            return self::FAILURE;
        }

        $faker = \Faker\Factory::create('hu_HU');
        $interval = max(1, (int) $this->option('interval'));
        $durationOption = $this->option('duration');
        $deadline = $durationOption ? now()->addSeconds((int) $durationOption) : null;

        $this->info("Élő szimuláció indul a(z) {$event->code} eseményhez ({$interval}s-enként). Állítsd le Ctrl+C-vel.");

        while (! $deadline || now()->lt($deadline)) {
            try {
                $this->performRandomAction($event, $faker, $operator, $registrar, $createRegistration, $checkIn, $transfer);
            } catch (ShelterFullException|AlreadyCheckedInException $e) {
                // Versenyhelyzet-szerű, ártalmatlan eset (pl. minden befogadóhely
                // épp betelt) — a következő körben másik akciót próbálunk.
                $this->line("<comment>Kihagyva:</comment> {$e->getMessage()}");
            }

            sleep($interval);
        }

        $this->info('Szimuláció leállt.');

        return self::SUCCESS;
    }

    private function performRandomAction(
        EvacuationEvent $event,
        \Faker\Generator $faker,
        User $operator,
        User $registrar,
        CreateRegistrationAction $createRegistration,
        CheckInPersonAction $checkIn,
        TransferPersonAction $transfer,
    ): void {
        $roll = $faker->numberBetween(1, 100);

        // 45% érkeztetés, 20% áthelyezés, 20% szállítóeszköz-pozíció, 15%
        // incidens — hozzávetőlegesen a valós arányokat követve (sok
        // regisztráció/érkezés, ritkább áthelyezés/pozícióváltás, még
        // ritkább rendkívüli esemény).
        match (true) {
            $roll <= 45 => $this->simulateCheckIn($event, $faker, $operator, $registrar, $createRegistration, $checkIn),
            $roll <= 65 => $this->simulateTransfer($event, $operator, $transfer),
            $roll <= 85 => $this->simulateTransportPosition($event),
            default => $this->simulateIncident($event, $faker, $registrar),
        };
    }

    private function simulateCheckIn(
        EvacuationEvent $event,
        \Faker\Generator $faker,
        User $operator,
        User $registrar,
        CreateRegistrationAction $createRegistration,
        CheckInPersonAction $checkIn,
    ): void {
        $shelter = $this->pickShelterWithCapacity($event);

        if (! $shelter) {
            $this->line('<comment>Kihagyva:</comment> minden befogadóhely betelt.');

            return;
        }

        $registration = Registration::where('event_id', $event->id)
            ->where('status', RegistrationStatus::Registered)
            ->inRandomOrder()
            ->first();

        $person = $registration
            ? $registration->person
            : $this->createSyntheticPerson($event, $faker, $registrar, $createRegistration);

        $checkIn->execute($event, $person, $shelter->shelter, $operator);

        $this->line(sprintf(
            '<info>[%s] Érkeztetve:</info> %s → %s (%d/%d)',
            now()->format('H:i:s'),
            $person->fullName(),
            $shelter->shelter->name,
            $shelter->fresh()->checked_in_count,
            $shelter->capacity_limit,
        ));
    }

    private function simulateTransfer(EvacuationEvent $event, User $operator, TransferPersonAction $transfer): void
    {
        $arrivedRegistration = Registration::where('event_id', $event->id)
            ->where('status', RegistrationStatus::ArrivedShelter)
            ->inRandomOrder()
            ->first();

        if (! $arrivedRegistration) {
            $this->line('<comment>Kihagyva:</comment> nincs jelenleg befogadóhelyen tartózkodó személy áthelyezéshez.');

            return;
        }

        $currentShelterId = $arrivedRegistration->person->checkins()->latest('checked_in_at')->first()?->shelter_id;

        $newShelter = $this->pickShelterWithCapacity($event, excludeShelterId: $currentShelterId);

        if (! $newShelter) {
            $this->line('<comment>Kihagyva:</comment> nincs másik befogadóhely szabad kapacitással.');

            return;
        }

        $transfer->execute($arrivedRegistration->person, $newShelter->shelter, $operator);

        $this->line(sprintf(
            '<info>[%s] Áthelyezve:</info> %s → %s',
            now()->format('H:i:s'),
            $arrivedRegistration->person->fullName(),
            $newShelter->shelter->name,
        ));
    }

    // Ugyanaz a jitter/célpont-választási logika, mint
    // TransportController::simulatePosition()-ben — szándékosan nem azt
    // hívjuk közvetlenül (HTTP-n keresztül konzolparancsból nem
    // praktikus), hanem ezt a kis, önmagában is jól olvasható másolatot
    // tartjuk itt fenn, ugyanúgy, ahogy az incidens-szimuláció is a saját
    // helyén hozza létre az Incident rekordot a kontroller helyett.
    private function simulateTransportPosition(EvacuationEvent $event): void
    {
        $transport = $event->transports()->inRandomOrder()->first();

        if (! $transport) {
            $transport = $event->transports()->create(['code' => 'Demó busz']);
        }

        $withCoords = $event->eventShelters()->with('shelter.municipality')->get()->filter(
            fn ($es) => $es->shelter?->municipality?->lat !== null && $es->shelter?->municipality?->lng !== null
        );

        if ($withCoords->isEmpty()) {
            $this->line('<comment>Kihagyva:</comment> nincs koordinátával rendelkező befogadóhely, a pozíció nem szimulálható.');

            return;
        }

        /** @var EventShelter $target */
        $target = $withCoords->random();
        $jitter = fn () => mt_rand(-600, 600) / 100000;

        $transport->update([
            'last_lat' => (float) $target->shelter->municipality->lat + $jitter(),
            'last_lng' => (float) $target->shelter->municipality->lng + $jitter(),
            'last_position_at' => now(),
        ]);

        $freshTransport = $transport->fresh();

        event(new TransportPositionUpdated($freshTransport));

        $this->line(sprintf(
            '<info>[%s] Pozíció frissítve:</info> %s (%.5f, %.5f)',
            now()->format('H:i:s'),
            $freshTransport->code,
            $freshTransport->last_lat,
            $freshTransport->last_lng,
        ));
    }

    private const INCIDENT_DESCRIPTIONS = [
        'complaint' => ['Panasz érkezett az étkeztetés minőségére.', 'Panasz a mosdók tisztaságával kapcsolatban.'],
        'conflict' => ['Vita alakult ki két család között a szálláshelyek beosztása miatt.', 'Hangos szóváltás a közösségi térben.'],
        'security' => ['Illetéktelen személy próbált bejutni a befogadóhelyre.', 'Elveszett értéktárgy bejelentése.'],
        'damage' => ['Vízvezeték-törés az egyik szálláshelyiségben.', 'Megrongálódott bútorzat a közösségi térben.'],
        'other' => ['Sürgős gyógyszerutánpótlás igénye merült fel.', 'Kisállat elszökött a befogadóhely területén.'],
    ];

    private function simulateIncident(EvacuationEvent $event, \Faker\Generator $faker, User $reporter): void
    {
        $category = $faker->randomElement(array_keys(self::INCIDENT_DESCRIPTIONS));
        $severity = $faker->randomElement(['low', 'medium', 'high']);
        $shelter = $event->eventShelters()->inRandomOrder()->first()?->shelter;

        $incident = Incident::create([
            'event_id' => $event->id,
            'shelter_id' => $shelter?->id,
            'category' => $category,
            'severity' => $severity,
            'description' => $faker->randomElement(self::INCIDENT_DESCRIPTIONS[$category]),
            'status' => 'open',
            'reported_by' => $reporter->id,
        ]);

        $incident->load('shelter');

        event(new IncidentCreated($incident));

        $this->line(sprintf(
            '<error>[%s] Incidens:</error> %s (%s) — %s',
            now()->format('H:i:s'),
            $category,
            $severity,
            $shelter?->name ?? 'esemény szintű',
        ));
    }

    private function pickShelterWithCapacity(EvacuationEvent $event, ?string $excludeShelterId = null): ?EventShelter
    {
        return $event->eventShelters()
            ->with('shelter')
            ->whereColumn('checked_in_count', '<', 'capacity_limit')
            ->when($excludeShelterId, fn ($q) => $q->where('shelter_id', '!=', $excludeShelterId))
            ->inRandomOrder()
            ->first();
    }

    private function createSyntheticPerson(
        EvacuationEvent $event,
        \Faker\Generator $faker,
        User $registrar,
        CreateRegistrationAction $createRegistration,
    ): Person {
        $municipality = Municipality::inRandomOrder()->first();

        return $createRegistration->execute($event, [
            'last_name' => $faker->lastName(),
            'first_name' => $faker->firstName(),
            'municipality_id' => $municipality->id,
        ], $registrar);
    }
}
