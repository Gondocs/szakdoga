<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('special_needs', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('person_id')->constrained('persons')->cascadeOnDelete();
            $table->string('category');
            $table->string('type')->nullable();
            $table->unsignedTinyInteger('priority')->default(1);
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index('person_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('special_needs');
    }
};
