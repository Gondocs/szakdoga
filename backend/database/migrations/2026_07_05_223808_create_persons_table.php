<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('persons', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('event_id')->constrained('evacuation_events')->cascadeOnDelete();
            $table->foreignUuid('family_id')->nullable()->constrained('families')->nullOnDelete();
            $table->foreignId('municipality_id')->constrained('municipalities')->restrictOnDelete();

            $table->string('last_name', 100);
            $table->string('first_name', 100);
            $table->string('birth_last_name', 100)->nullable();
            $table->string('birth_first_name', 100)->nullable();
            $table->string('birth_place')->nullable();
            $table->date('birth_date')->nullable();
            $table->string('mother_birth_name', 200)->nullable();

            $table->string('address_postal_code', 10)->nullable();
            $table->string('address_settlement')->nullable();
            $table->string('address_street')->nullable();
            $table->string('address_house_number', 50)->nullable();

            $table->string('phone', 50)->nullable();
            $table->string('email')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('event_id');
            $table->index('family_id');
            $table->index('municipality_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('persons');
    }
};
