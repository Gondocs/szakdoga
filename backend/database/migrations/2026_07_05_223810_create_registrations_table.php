<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('person_id')->constrained('persons')->cascadeOnDelete();
            $table->foreignUuid('event_id')->constrained('evacuation_events')->cascadeOnDelete();
            $table->string('status')->default('registered');

            $table->boolean('central_transport_required')->default(false);
            $table->boolean('central_accommodation_required')->default(false);
            $table->boolean('under_regular_medical_care')->default(false);
            $table->boolean('own_vehicle')->default(false);
            $table->boolean('travels_alone')->nullable();

            $table->timestamp('registered_at');
            $table->foreignId('registered_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['person_id', 'event_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registrations');
    }
};
