<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checkins', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('event_id')->constrained('evacuation_events')->cascadeOnDelete();
            $table->foreignUuid('person_id')->constrained('persons')->cascadeOnDelete();
            $table->foreignUuid('shelter_id')->constrained('shelters')->restrictOnDelete();
            $table->timestamp('checked_in_at');
            $table->foreignId('checked_in_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['event_id', 'shelter_id', 'checked_in_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checkins');
    }
};
