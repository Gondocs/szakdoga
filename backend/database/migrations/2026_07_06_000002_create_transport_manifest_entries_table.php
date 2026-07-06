<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Egy személy egy adott járművön tartózkodásának nyilvántartása: felszálláskor
 * (boarded_at) és leszálláskor (alighted_at) QR-kód beolvasásával kerül
 * rögzítésre (Interreg tanulmány "Szállítási Kontroll" funkciója).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transport_manifest_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('transport_id')->constrained('transports')->cascadeOnDelete();
            $table->foreignUuid('event_id')->constrained('evacuation_events')->cascadeOnDelete();
            $table->foreignUuid('person_id')->constrained('persons')->cascadeOnDelete();
            $table->timestamp('boarded_at');
            $table->foreignId('boarded_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('alighted_at')->nullable();
            $table->foreignId('alighted_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['transport_id', 'alighted_at']);
            $table->index(['event_id', 'person_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transport_manifest_entries');
    }
};
