import type { SpecialNeedCategory } from '../types';

export interface SpecialNeedOption {
  value: string;
  label: string;
}

export const specialNeedCategoryLabels: Record<SpecialNeedCategory, string> = {
  medical: 'Egészségügyi',
  mobility: 'Mozgás-/érzékszervi korlátozottság',
  age: 'Életkor szerinti',
  diet: 'Diétás igény',
  animal: 'Állattartás',
  other: 'Egyéb',
};

/**
 * Előre definiált, gyakori speciális igény katalógus, hogy a regisztráció
 * során ne kelljen szabad szöveget begépelni (kevesebb elírás, egységes
 * adatok a kimutatásokhoz). A "type" mező ebből a listából választható;
 * bármi, ami nem illik bele, az "Egyéb" opcióval és a szöveges megjegyzés
 * mezővel rögzíthető.
 */
export const specialNeedOptions: Record<SpecialNeedCategory, SpecialNeedOption[]> = {
  medical: [
    { value: 'diabetes', label: 'Cukorbetegség / inzulinfüggő' },
    { value: 'dialysis', label: 'Dialízis kezelés alatt áll' },
    { value: 'heart_disease', label: 'Szívbetegség' },
    { value: 'respiratory', label: 'Légzőszervi betegség / oxigénfüggő' },
    { value: 'epilepsy', label: 'Epilepszia' },
    { value: 'severe_allergy', label: 'Súlyos allergia' },
    { value: 'cancer_treatment', label: 'Daganatos betegség / kezelés alatt' },
    { value: 'infectious_disease', label: 'Fertőző betegség (elkülönítés szükséges)' },
    { value: 'mental_health', label: 'Pszichés/mentális egészségügyi ellátás' },
    { value: 'regular_medication', label: 'Rendszeres, létfontosságú gyógyszerszedés' },
    { value: 'other_medical', label: 'Egyéb egészségügyi ok' },
  ],
  mobility: [
    { value: 'wheelchair', label: 'Kerekesszéket használ' },
    { value: 'walking_aid', label: 'Járókeretet / mankót használ' },
    { value: 'bedridden', label: 'Ágyhoz kötött' },
    { value: 'blind', label: 'Látássérült' },
    { value: 'deaf', label: 'Hallássérült' },
    { value: 'intellectual_disability', label: 'Értelmi fogyatékosság' },
    { value: 'other_mobility', label: 'Egyéb mozgás-/érzékszervi korlátozottság' },
  ],
  age: [
    { value: 'infant', label: 'Csecsemő (0–1 év)' },
    { value: 'young_child', label: 'Kisgyermek (1–6 év)' },
    { value: 'pregnant', label: 'Várandós' },
    { value: 'elderly', label: 'Idős, önellátásra képes' },
    { value: 'elderly_dependent', label: 'Idős, gondozásra szorul' },
  ],
  diet: [
    { value: 'gluten_free', label: 'Gluténmentes' },
    { value: 'diabetic_diet', label: 'Cukorbeteg diéta' },
    { value: 'lactose_free', label: 'Laktózmentes' },
    { value: 'vegetarian', label: 'Vegetáriánus' },
    { value: 'vegan', label: 'Vegán' },
    { value: 'baby_food', label: 'Bébiétel szükséges' },
    { value: 'other_diet', label: 'Egyéb diétás igény' },
  ],
  animal: [
    { value: 'dog', label: 'Kutya' },
    { value: 'cat', label: 'Macska' },
    { value: 'small_pet', label: 'Kisállat (rágcsáló, madár, stb.)' },
    { value: 'livestock', label: 'Haszonállat' },
    { value: 'other_animal', label: 'Egyéb állat' },
  ],
  other: [
    { value: 'language_barrier', label: 'Nyelvi akadály / tolmács szükséges' },
    { value: 'unaccompanied_minor', label: 'Kísérő nélküli kiskorú' },
    { value: 'documentation_missing', label: 'Hiányzó személyes okmányok' },
    { value: 'domestic_violence_risk', label: 'Veszélyeztetett helyzet (védelmi igény)' },
    { value: 'other', label: 'Egyéb, lásd megjegyzés' },
  ],
};
