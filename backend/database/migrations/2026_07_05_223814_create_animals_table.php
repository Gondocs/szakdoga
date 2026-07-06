<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('animals', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('person_id')->constrained('persons')->cascadeOnDelete();
            $table->string('animal_type');
            $table->unsignedInteger('count')->default(1);
            $table->boolean('stays_at_address')->default(false);
            $table->timestamps();

            $table->index('person_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('animals');
    }
};
