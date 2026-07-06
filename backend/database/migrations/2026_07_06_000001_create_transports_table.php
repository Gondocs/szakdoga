<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Interreg tanulmány "Szállítási/Útvonal-nyilvántartás" funkciója: a
 * szervezett kitelepítés során használt járművek (busz, vonat) nyilvántartása
 * eseményenként, hogy a fel-/leszállás QR-kóddal nyomon követhető legyen.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('event_id')->constrained('evacuation_events')->cascadeOnDelete();
            $table->string('code', 100);
            $table->unsignedInteger('capacity')->nullable();
            $table->timestamps();

            $table->index(['event_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transports');
    }
};
