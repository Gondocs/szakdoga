<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PersonDocumentPhotoTest extends TestCase
{
    use RefreshDatabase;

    public function test_registrar_can_upload_and_delete_front_and_back_document_photos_independently(): void
    {
        Storage::fake('public');

        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-DOC-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');
        $event = EvacuationEvent::findOrFail($eventId);

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $frontPhoto = UploadedFile::fake()->image('okmany-elol.jpg');
        $frontResponse = $this->post("/api/persons/{$personId}/document-photo", ['photo' => $frontPhoto, 'side' => 'front']);
        $frontResponse->assertOk();
        $this->assertNotNull($frontResponse->json('data.document_photo_front_url'));
        $this->assertNull($frontResponse->json('data.document_photo_back_url'));

        $backPhoto = UploadedFile::fake()->image('okmany-hatul.jpg');
        $backResponse = $this->post("/api/persons/{$personId}/document-photo", ['photo' => $backPhoto, 'side' => 'back']);
        $backResponse->assertOk();
        $this->assertNotNull($backResponse->json('data.document_photo_front_url'));
        $this->assertNotNull($backResponse->json('data.document_photo_back_url'));

        // A hátulja törlése nem érinti az elejét.
        $this->deleteJson("/api/persons/{$personId}/document-photo?side=back")
            ->assertOk()
            ->assertJsonPath('data.document_photo_back_url', null);
        $this->assertDatabaseMissing('persons', ['id' => $personId, 'document_photo_front_path' => null]);

        $this->deleteJson("/api/persons/{$personId}/document-photo?side=front")
            ->assertOk()
            ->assertJsonPath('data.document_photo_front_url', null);
    }

    public function test_shelter_operator_cannot_upload_a_document_photo(): void
    {
        Storage::fake('public');

        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-DOC-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::ShelterOperator);
        $photo = UploadedFile::fake()->image('okmany.jpg');
        $this->post("/api/persons/{$personId}/document-photo", ['photo' => $photo, 'side' => 'front'])->assertForbidden();
    }
}
