<?php

namespace App\Actions\Registrations;

use App\Enums\RegistrationChannel;
use App\Enums\RegistrationStatus;
use App\Models\Animal;
use App\Models\Citizen;
use App\Models\EvacuationEvent;
use App\Models\Family;
use App\Models\Person;
use App\Models\Registration;
use App\Models\SpecialNeed;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Support\Facades\DB;

class CreateRegistrationAction
{
    public function __construct(private readonly AuditService $auditService)
    {
    }

    /**
     * Egy személy (és opcionálisan az új családja) regisztrációját hozza létre egy
     * tranzakcióban: person, family (ha szükséges), registration, special_needs, animals.
     */
    public function execute(
        EvacuationEvent $event,
        array $data,
        User $registrar,
        RegistrationChannel $channel = RegistrationChannel::Staff,
    ): Person {
        return DB::transaction(function () use ($event, $data, $registrar, $channel) {
            $family = null;

            if (! empty($data['family_id'])) {
                $family = Family::where('event_id', $event->id)->findOrFail($data['family_id']);
            } elseif (! empty($data['create_new_family'])) {
                // Sorban következő családkód generálása eseményenként
                // (pl. "CSAL-004"); a lockForUpdate() zárolással véd a
                // párhuzamos regisztrációk okozta kódütközés ellen
                $nextNumber = Family::where('event_id', $event->id)->lockForUpdate()->count() + 1;
                $family = Family::create([
                    'event_id' => $event->id,
                    'family_code' => sprintf('CSAL-%03d', $nextNumber),
                ]);
            }

            $citizen = $this->resolveCitizen($data);

            $person = Person::create([
                'event_id' => $event->id,
                'citizen_id' => $citizen?->id,
                'family_id' => $family?->id,
                'municipality_id' => $data['municipality_id'],
                'last_name' => $data['last_name'],
                'first_name' => $data['first_name'],
                'birth_last_name' => $data['birth_last_name'] ?? null,
                'birth_first_name' => $data['birth_first_name'] ?? null,
                'birth_place' => $data['birth_place'] ?? null,
                'birth_date' => $data['birth_date'] ?? null,
                'gender' => $data['gender'] ?? null,
                'id_document_number' => $data['id_document_number'] ?? null,
                'mother_birth_name' => $data['mother_birth_name'] ?? null,
                'address_postal_code' => $data['address_postal_code'] ?? null,
                'address_settlement' => $data['address_settlement'] ?? null,
                'address_street' => $data['address_street'] ?? null,
                'address_house_number' => $data['address_house_number'] ?? null,
                'phone' => $data['phone'] ?? null,
                'email' => $data['email'] ?? null,
                'created_by' => $registrar->id,
                'updated_by' => $registrar->id,
            ]);

            if ($family && empty($family->primary_contact_person_id) && ! empty($data['is_primary_contact'])) {
                $family->update(['primary_contact_person_id' => $person->id]);
            }

            $registration = Registration::create([
                'person_id' => $person->id,
                'event_id' => $event->id,
                'status' => RegistrationStatus::Registered,
                'channel' => $channel,
                'central_transport_required' => $data['central_transport_required'] ?? false,
                'central_accommodation_required' => $data['central_accommodation_required'] ?? false,
                'under_regular_medical_care' => $data['under_regular_medical_care'] ?? false,
                'own_vehicle' => $data['own_vehicle'] ?? false,
                'travels_alone' => $data['travels_alone'] ?? null,
                'registered_at' => now(),
                'registered_by' => $registrar->id,
            ]);

            // Az esetleges különleges igények (pl. mozgáskorlátozottság,
            // gyógyszerigény) mentése a személyhez
            foreach ($data['special_needs'] ?? [] as $need) {
                SpecialNeed::create([
                    'person_id' => $person->id,
                    'category' => $need['category'],
                    'type' => $need['type'] ?? null,
                    'priority' => $need['priority'] ?? 1,
                    'description' => $need['description'] ?? null,
                ]);
            }

            // A személyhez tartozó állatok (pl. kutya, macska) rögzítése
            foreach ($data['animals'] ?? [] as $animal) {
                Animal::create([
                    'person_id' => $person->id,
                    'animal_type' => $animal['animal_type'],
                    'count' => $animal['count'] ?? 1,
                    'stays_at_address' => $animal['stays_at_address'] ?? false,
                ]);
            }

            $this->auditService->log('create', $person, $registrar, null, $person->fresh(['registration', 'specialNeeds', 'animals'])->toArray());

            return $person->fresh(['family', 'registration', 'specialNeeds', 'animals']);
        });
    }

    /**
     * Az okmányszám alapján megkeresi vagy létrehozza az eseményfüggetlen
     * "polgár" törzsadatot, hogy ugyanaz a személy több kitelepítési esemény
     * között is nyomon követhető maradjon. Okmányszám nélkül nincs mit
     * illeszteni, ilyenkor a személy egyedi, önálló regisztrációként jön létre.
     */
    private function resolveCitizen(array $data): ?Citizen
    {
        if (empty($data['id_document_number'])) {
            return null;
        }

        return Citizen::firstOrCreate(
            ['id_document_number' => $data['id_document_number']],
            [
                'last_name' => $data['last_name'],
                'first_name' => $data['first_name'],
                'birth_last_name' => $data['birth_last_name'] ?? null,
                'birth_first_name' => $data['birth_first_name'] ?? null,
                'birth_place' => $data['birth_place'] ?? null,
                'birth_date' => $data['birth_date'] ?? null,
                'gender' => $data['gender'] ?? null,
                'mother_birth_name' => $data['mother_birth_name'] ?? null,
                'phone' => $data['phone'] ?? null,
                'email' => $data['email'] ?? null,
            ]
        );
    }
}
