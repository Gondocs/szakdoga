<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A families.primary_contact_person_id és a persons.family_id kölcsönösen hivatkoznak
     * egymásra, ezért a families tábla csak a persons tábla létrehozása UTÁN kapja meg ezt
     * az oszlopot. Az adatbázis szintű FK-kényszert szándékosan nem alkalmazzuk (SQLite ALTER
     * TABLE korlátja + körkörös függőség), az integritást az alkalmazás rétege biztosítja.
     */
    public function up(): void
    {
        Schema::table('families', function (Blueprint $table) {
            $table->uuid('primary_contact_person_id')->nullable()->after('family_code');
        });
    }

    public function down(): void
    {
        Schema::table('families', function (Blueprint $table) {
            $table->dropColumn('primary_contact_person_id');
        });
    }
};
