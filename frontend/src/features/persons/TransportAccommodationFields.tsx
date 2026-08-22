import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import HotelIcon from '@mui/icons-material/Hotel';
import { SelectableToggleCard } from '../../components/ui/SelectableToggleCard';

interface TransportAccommodationFieldsProps {
  centralTransportRequired: boolean;
  onCentralTransportRequiredChange: (value: boolean) => void;
  centralAccommodationRequired: boolean;
  onCentralAccommodationRequiredChange: (value: boolean) => void;
  transportLabel?: string;
  accommodationLabel?: string;
  transportDescription?: string;
  accommodationDescription?: string;
}

/**
 * A "kér-e központi szállítást" / "kér-e elszállásolást" jelölőpár — ez az a
 * mezőpár, ami korábban csak az egyik regisztrációs felületre került be, a
 * másikból (előregisztráció) hiányzott, mire észrevettük. Ide kiemelve egy
 * jövőbeli hasonló mezőbővítés strukturálisan nem tud csak az egyik oldalon
 * megjelenni.
 *
 * Csak a két kártyát adja vissza (nincs saját elrendező konténere) — a
 * hívó fél dönti el, hogy egy nagyobb jelölő-rács részeként vagy önállóan,
 * egy függőleges lista elemeiként jelenjenek meg (lásd FamilyMemberForm,
 * EditPersonDialog).
 */
export function TransportAccommodationFields({
  centralTransportRequired,
  onCentralTransportRequiredChange,
  centralAccommodationRequired,
  onCentralAccommodationRequiredChange,
  transportLabel = 'Központi szállítást igényel',
  accommodationLabel = 'Központi elszállásolást igényel',
  transportDescription = 'Akkor válassza, ha nincs saját járműve, és a hatóság által szervezett busszal/kisbusszal szeretne eljutni a gyülekezőpontra vagy a befogadóhelyre.',
  accommodationDescription = 'Akkor válassza, ha nincs hova mennie, és a hatóság által kijelölt befogadóhelyen szeretne megszállni a kitelepítés alatt.',
}: TransportAccommodationFieldsProps) {
  return (
    <>
      <SelectableToggleCard
        checked={centralTransportRequired}
        onChange={onCentralTransportRequiredChange}
        icon={<DirectionsBusIcon fontSize="small" />}
        label={transportLabel}
        description={transportDescription}
      />
      <SelectableToggleCard
        checked={centralAccommodationRequired}
        onChange={onCentralAccommodationRequiredChange}
        icon={<HotelIcon fontSize="small" />}
        label={accommodationLabel}
        description={accommodationDescription}
      />
    </>
  );
}
