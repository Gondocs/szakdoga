<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->after('id')->constrained('roles')->nullOnDelete();
            $table->uuid('shelter_id')->nullable()->after('role_id')
                ->comment('Befogadóhelyi kezelő szerepkörhöz kötött befogadóhely (FK a shelters táblára a shelters migráció után kerül rá).');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('role_id');
            $table->dropColumn('shelter_id');
        });
    }
};
