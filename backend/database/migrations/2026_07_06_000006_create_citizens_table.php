<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Eseményfüggetlen "polgár" törzsadat: a személyazonosító okmány száma
 * alapján egyesíti ugyanannak a személynek a különböző kitelepítési
 * eseményekhez tartozó regisztrációit, hogy a korábbi kitelepítési
 * történet is megőrizhető és lekérdezhető legyen.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('citizens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('id_document_number', 50)->unique();
            $table->string('last_name', 100);
            $table->string('first_name', 100);
            $table->string('birth_last_name', 100)->nullable();
            $table->string('birth_first_name', 100)->nullable();
            $table->string('birth_place')->nullable();
            $table->date('birth_date')->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('mother_birth_name', 200)->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('email')->nullable();
            $table->timestamps();
        });

        Schema::table('persons', function (Blueprint $table) {
            $table->foreignUuid('citizen_id')->nullable()->after('event_id')->constrained('citizens')->nullOnDelete();
            $table->index('citizen_id');
        });
    }

    public function down(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->dropConstrainedForeignId('citizen_id');
        });

        Schema::dropIfExists('citizens');
    }
};
