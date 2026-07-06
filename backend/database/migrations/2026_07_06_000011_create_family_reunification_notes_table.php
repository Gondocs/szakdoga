<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('family_reunification_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('family_id')->constrained('families')->cascadeOnDelete();
            $table->text('note');
            $table->boolean('resolved')->default(false);
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('family_reunification_notes');
    }
};
