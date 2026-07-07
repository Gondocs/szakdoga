<?php

namespace App\Http\Resources;

use App\Enums\RoleCode;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Interreg tanulmány "Adatmaszkolás: minden felhasználó csak a feladatához
 * szükséges adatot lássa" elve (18. fejezet): az okmányazonosító adatokat
 * (okmányszám, okmányfényképek, születési hely) csak a regisztrációért
 * felelős szerepkörök (admin, vezető, regisztrátor) látják; az elérhetőségi
 * és lakcímadatokat ezen felül a befogadóhelyi kezelők is (mert szükségük
 * van rá az elhelyezetteikkel való kapcsolattartáshoz), az auditor
 * szerepkör viszont — mivel a feladata az eljárások, nem a személyes
 * adatok ellenőrzése — egyiket sem kapja meg.
 */
class PersonResource extends JsonResource
{
    /**
     * A lakossági önkiszolgáló felület (routes/api.php publikus, throttle-olt
     * csoportja) nem `auth:sanctum` munkatárs-munkamenetként fut, hanem a
     * saját QR-azonosítóján keresztül; ott nincs $request->user(), de az
     * érintettnek a SAJÁT adatait maszkolás nélkül kell látnia/szerkesztenie.
     */
    private bool $bypassMasking;

    public function __construct($resource, bool $bypassMasking = false)
    {
        parent::__construct($resource);
        $this->bypassMasking = $bypassMasking;
    }

    public function toArray(Request $request): array
    {
        $user = $request->user();
        $canViewIdentityDocuments = $this->bypassMasking || (bool) $user?->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar);
        $canViewContactDetails = $this->bypassMasking || (bool) $user?->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar, RoleCode::ShelterOperator);

        return [
            'id' => $this->id,
            'event_id' => $this->event_id,
            'citizen_id' => $this->citizen_id,
            'family_id' => $this->family_id,
            'family' => $this->whenLoaded('family', fn () => $this->family ? [
                'id' => $this->family->id,
                'family_code' => $this->family->family_code,
            ] : null),
            'last_name' => $this->last_name,
            'first_name' => $this->first_name,
            'full_name' => $this->fullName(),
            'birth_place' => $canViewIdentityDocuments ? $this->birth_place : null,
            'birth_date' => $this->birth_date?->toDateString(),
            'gender' => $this->gender?->value,
            'id_document_number' => $canViewIdentityDocuments ? $this->id_document_number : null,
            'document_photo_front_url' => $canViewIdentityDocuments ? $this->documentPhotoFrontUrl() : null,
            'document_photo_back_url' => $canViewIdentityDocuments ? $this->documentPhotoBackUrl() : null,
            'municipality' => $this->whenLoaded('municipality', fn () => [
                'id' => $this->municipality->id,
                'name' => $this->municipality->name,
            ]),
            'address' => [
                'postal_code' => $this->address_postal_code,
                'settlement' => $this->address_settlement,
                'street' => $canViewContactDetails ? $this->address_street : null,
                'house_number' => $canViewContactDetails ? $this->address_house_number : null,
            ],
            'phone' => $canViewContactDetails ? $this->phone : null,
            'email' => $canViewContactDetails ? $this->email : null,
            'data_masked' => ! $canViewIdentityDocuments || ! $canViewContactDetails,
            'registration' => $this->whenLoaded('registration', fn () => $this->registration ? [
                'id' => $this->registration->id,
                'status' => $this->registration->status->value,
                'channel' => $this->registration->channel?->value,
                'central_transport_required' => $this->registration->central_transport_required,
                'central_accommodation_required' => $this->registration->central_accommodation_required,
                'under_regular_medical_care' => $this->registration->under_regular_medical_care,
                'own_vehicle' => $this->registration->own_vehicle,
                'travels_alone' => $this->registration->travels_alone,
                'registered_at' => $this->registration->registered_at?->toIso8601String(),
                'self_arrival_confirmed_at' => $this->registration->self_arrival_confirmed_at?->toIso8601String(),
            ] : null),
            'current_shelter' => $this->whenLoaded('checkins', function () {
                $latest = $this->checkins->sortByDesc('checked_in_at')->first();

                return $latest ? [
                    'id' => $latest->shelter_id,
                    'name' => $latest->shelter?->name,
                ] : null;
            }),
            'special_needs' => SpecialNeedResource::collection($this->whenLoaded('specialNeeds')),
            'animals' => $this->whenLoaded('animals', fn () => $this->animals->map(fn ($a) => [
                'id' => $a->id,
                'animal_type' => $a->animal_type,
                'count' => $a->count,
                'stays_at_address' => $a->stays_at_address,
            ])),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
