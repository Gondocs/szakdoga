<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('event_id')->constrained('evacuation_events')->cascadeOnDelete();
            $table->foreignUuid('shelter_id')->nullable()->constrained('shelters')->nullOnDelete();
            $table->foreignUuid('person_id')->nullable()->constrained('persons')->nullOnDelete();
            $table->string('category');
            $table->string('severity');
            $table->text('description');
            $table->string('status')->default('open');
            $table->foreignId('reported_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['event_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incidents');
    }
};
