<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('qr_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('event_id')->constrained('evacuation_events')->cascadeOnDelete();
            $table->foreignUuid('person_id')->nullable()->constrained('persons')->cascadeOnDelete();
            $table->foreignUuid('family_id')->nullable()->constrained('families')->cascadeOnDelete();
            $table->string('public_id')->unique();
            $table->string('token_hash');
            $table->string('status')->default('active');
            $table->foreignId('issued_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qr_tokens');
    }
};
