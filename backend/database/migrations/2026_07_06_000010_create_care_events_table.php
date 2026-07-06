<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('care_events', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('person_id')->constrained('persons')->cascadeOnDelete();
            $table->foreignUuid('event_id')->constrained('evacuation_events')->cascadeOnDelete();
            $table->foreignUuid('shelter_id')->nullable()->constrained('shelters')->nullOnDelete();
            $table->string('category');
            $table->string('note')->nullable();
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['person_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('care_events');
    }
};
