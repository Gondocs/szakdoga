<?php

namespace Database\Seeders;

use App\Actions\Qr\IssueQrTokenAction;
use App\Actions\Registrations\CreateRegistrationAction;
use App\Actions\Registrations\UpdateRegistrationStatusAction;
use App\Actions\Shelters\CheckInPersonAction;
use App\Enums\RegistrationStatus;
use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\Transport;
use App\Models\TransportManifestEntry;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\App;

class SyntheticRegistrationSeeder extends Seeder
{
    /**
     * Előre definiált, a frontend katalógusával (constants/specialNeeds.ts)
     * összhangban lévő egyedi igény típusok kategóriánként, hogy a szintetikus
     * demóadat a valós katalógust reprezentálja, ne kitalált szabad szöveget.
     */
    private const SPECIAL_NEED_TYPES = [
        'medical' => ['diabetes', 'dialysis', 'heart_disease', 'respiratory', 'epilepsy', 'severe_allergy', 'regular_medication'],
        'mobility' => ['wheelchair', 'walking_aid', 'blind', 'deaf', 'bedridden'],
        'age' => ['infant', 'young_child', 'pregnant', 'elderly', 'elderly_dependent'],
        'diet' => ['gluten_free', 'diabetic_diet', 'lactose_free', 'vegetarian', 'vegan'],
        'animal' => ['dog', 'cat', 'small_pet'],
        'other' => ['language_barrier', 'unaccompanied_minor', 'documentation_missing'],
    ];

    /**
     * Szintetikus (nem valós) személyek, családok, szállítóeszközök és
     * érkeztetések generálása a bemutatható MVP-demóhoz. Az app rétegének
     * Action osztályait használja, hogy a tesztadatok is a valódi üzleti
     * szabályokon (tranzakció, audit, kapacitásfigyelés) menjenek keresztül.
     */
    public function run(): void
    {
        $event = EvacuationEvent::where('code', 'EVT-2026-001')->firstOrFail();
        $registrar = User::where('email', 'regisztrator@katasztrofavedelem.test')->firstOrFail();
        $shelterOperator = User::whereHas('role', fn ($q) => $q->where('code', RoleCode::ShelterOperator->value))->firstOrFail();
        $municipalities = Municipality::all()->keyBy('id');
        $municipalityIds = $municipalities->keys()->all();

        // Magyar nyelvű névgenerálás (Győr-Moson-Sopron megyei demóadathoz), a
        // globális fake() helyett, hogy a nevek/utcanevek ne angol/amerikai
        // placeholderek legyenek.
        $faker = \Faker\Factory::create('hu_HU');

        $createRegistration = App::make(CreateRegistrationAction::class);
        $issueQr = App::make(IssueQrTokenAction::class);
        $checkIn = App::make(CheckInPersonAction::class);
        $updateStatus = App::make(UpdateRegistrationStatusAction::class);

        $eventShelters = $event->eventShelters()->get();

        $familyCount = 200;
        $createdPersons = [];

        for ($f = 0; $f < $familyCount; $f++) {
            $familySize = $faker->numberBetween(1, 5);
            $createNewFamily = $familySize > 1;
            $familyId = null;
            $sharedLastName = $faker->lastName();
            $familyMunicipality = $municipalities->get($faker->randomElement($municipalityIds));

            for ($m = 0; $m < $familySize; $m++) {
                $genderRoll = $faker->numberBetween(1, 100);
                $gender = $genderRoll <= 48 ? 'male' : ($genderRoll <= 96 ? 'female' : 'other');

                $data = [
                    'last_name' => $sharedLastName,
                    'first_name' => $faker->firstName($gender === 'other' ? null : $gender),
                    'birth_place' => $faker->city(),
                    'birth_date' => $faker->dateTimeBetween('-85 years', '-1 years')->format('Y-m-d'),
                    'gender' => $gender,
                    'id_document_number' => strtoupper($faker->bothify('######??')),
                    'mother_birth_name' => $faker->name('female'),
                    'municipality_id' => $familyMunicipality->id,
                    'address_postal_code' => $familyMunicipality->postal_code,
                    'address_settlement' => $familyMunicipality->name,
                    'address_street' => $faker->streetName(),
                    'address_house_number' => (string) $faker->numberBetween(1, 99),
                    'phone' => $faker->boolean(70) ? $faker->phoneNumber() : null,
                    'email' => $faker->boolean(40) ? $faker->safeEmail() : null,
                    'central_transport_required' => $faker->boolean(20),
                    'central_accommodation_required' => $faker->boolean(30),
                    'under_regular_medical_care' => $faker->boolean(12),
                    'own_vehicle' => $faker->boolean(50),
                    'travels_alone' => $familySize === 1 ? $faker->boolean(70) : false,
                    'create_new_family' => $createNewFamily && $m === 0,
                    'family_id' => $familyId,
                    'is_primary_contact' => $m === 0,
                ];

                if ($faker->boolean(22)) {
                    $category = $faker->randomElement(array_keys(self::SPECIAL_NEED_TYPES));
                    $data['special_needs'] = [[
                        'category' => $category,
                        'type' => $faker->randomElement(self::SPECIAL_NEED_TYPES[$category]),
                        'priority' => $faker->numberBetween(1, 5),
                        'description' => $faker->boolean(40) ? $faker->sentence() : null,
                    ]];
                }

                if ($faker->boolean(12)) {
                    $data['animals'] = [[
                        'animal_type' => $faker->randomElement(['kutya', 'macska', 'nyúl']),
                        'count' => $faker->numberBetween(1, 2),
                        'stays_at_address' => false,
                    ]];
                }

                $person = $createRegistration->execute($event, $data, $registrar);

                if ($createNewFamily && $m === 0) {
                    $familyId = $person->family_id;
                }

                $createdPersons[] = $person;
            }
        }

        // QR-tokenek kiadása minden személyhez.
        foreach ($createdPersons as $person) {
            $issueQr->execute($person, $registrar);
        }

        // Eseményfüggetlen jármű-flotta törzsadatai (Citizen/Person mintájára):
        // egy járművet egyszer veszünk fel, utána tetszőleges eseményhez
        // hozzárendelhető szállítóeszközként, dupla lefoglalás elleni védelemmel.
        $vehicle1 = Vehicle::firstOrCreate(
            ['plate_number' => 'GYR-001'],
            ['label' => '1. sz. busz', 'capacity' => 50, 'driver_name' => $faker->name('male')]
        );
        $vehicle2 = Vehicle::firstOrCreate(
            ['plate_number' => 'GYR-002'],
            ['label' => '2. sz. busz', 'capacity' => 45, 'driver_name' => $faker->name('male')]
        );
        Vehicle::firstOrCreate(['plate_number' => 'GYR-003'], ['label' => '3. sz. busz (tartalék)', 'capacity' => 50]);
        Vehicle::firstOrCreate(['plate_number' => 'GYR-004'], ['label' => '4. sz. busz (tartalék)', 'capacity' => 55]);

        // Szállítóeszközök felvétele az eseményhez (Interreg tanulmány
        // "Szállítási/Útvonal-nyilvántartás" funkciója).
        $transports = collect([
            ['code' => '1. sz. busz - Győr', 'capacity' => 50, 'vehicle_id' => $vehicle1->id],
            ['code' => '2. sz. busz - Mosonmagyaróvár', 'capacity' => 45, 'vehicle_id' => $vehicle2->id],
            ['code' => 'Vasúti szerelvény - Csorna irány', 'capacity' => 120],
            ['code' => 'Mentőjármű - kiemelt ellátás', 'capacity' => 4],
        ])->map(fn ($t) => $event->transports()->create($t));

        // A "Vasúti szerelvény" pozíciójának szimulálása, hogy a térképes
        // nézet üres eseménybetöltéskor is mutasson egy járművet.
        $shelterWithCoords = $eventShelters->first(
            fn ($es) => $es->shelter?->municipality?->lat !== null && $es->shelter?->municipality?->lng !== null
        );
        if ($shelterWithCoords) {
            $transports[2]->update([
                'last_lat' => (float) $shelterWithCoords->shelter->municipality->lat + (mt_rand(-300, 300) / 100000),
                'last_lng' => (float) $shelterWithCoords->shelter->municipality->lng + (mt_rand(-300, 300) / 100000),
                'last_position_at' => now()->subMinutes(fake()->numberBetween(2, 40)),
            ]);
        }

        // A személyek egy részét érkeztetjük befogadóhelyre, egy másik részét
        // "szállítás alatt" állapotba tesszük a szállítóeszközök manifesztjén
        // keresztül, a többiek "regisztrált" állapotban maradnak.
        $shuffled = collect($createdPersons)->shuffle();
        $toCheckIn = $shuffled->take((int) round(count($createdPersons) * 0.5));
        $remaining = $shuffled->skip($toCheckIn->count());
        $toBoardOnly = $remaining->take((int) round(count($createdPersons) * 0.2));

        foreach ($toCheckIn as $person) {
            $eventShelter = fake()->randomElement($eventShelters->all());

            if ($eventShelter->checked_in_count >= $eventShelter->capacity_limit) {
                continue;
            }

            try {
                $checkIn->execute($event, $person, $eventShelter->shelter, $shelterOperator);
                $eventShelter->refresh();
            } catch (\Throwable) {
                // Kapacitás vagy státusz ütközés esetén a szintetikus adat egyszerűen kimarad.
            }
        }

        foreach ($toBoardOnly as $person) {
            $transport = $transports->random();

            TransportManifestEntry::create([
                'transport_id' => $transport->id,
                'event_id' => $event->id,
                'person_id' => $person->id,
                'boarded_at' => now()->subMinutes(fake()->numberBetween(5, 90)),
                'boarded_by' => $registrar->id,
            ]);

            if ($person->registration) {
                $updateStatus->execute($person->registration, RegistrationStatus::InTransport, $registrar);
            }
        }
    }
}
