<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_shelters', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('event_id')->constrained('evacuation_events')->cascadeOnDelete();
            $table->foreignUuid('shelter_id')->constrained('shelters')->cascadeOnDelete();
            $table->unsignedInteger('capacity_limit');
            $table->unsignedInteger('checked_in_count')->default(0);
            $table->timestamps();

            $table->unique(['event_id', 'shelter_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_shelters');
    }
};
