import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AccessibleForwardIcon from '@mui/icons-material/AccessibleForward';
import ChildFriendlyIcon from '@mui/icons-material/ChildFriendly';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import PetsIcon from '@mui/icons-material/Pets';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip, type SvgIconProps } from '@mui/material';
import type { SpecialNeedCategory } from '../../types';
import { specialNeedDetailLabel } from '../../constants/specialNeeds';

const iconMap: Record<SpecialNeedCategory, typeof LocalHospitalIcon> = {
  medical: LocalHospitalIcon,
  mobility: AccessibleForwardIcon,
  age: ChildFriendlyIcon,
  diet: RestaurantIcon,
  animal: PetsIcon,
  other: HelpOutlineIcon,
};

interface SpecialNeedIconProps extends SvgIconProps {
  category: SpecialNeedCategory;
  /** Az adott igény pontos típusa (előre definiált katalógusból), ha ismert — pontosabb tooltiphez. */
  needType?: string | null;
  /** Szabad szöveges megjegyzés, ha nincs katalógusbeli típus — ez kerül a tooltipbe helyette. */
  needDescription?: string | null;
  /** Egyedi tooltip szöveg, ami felülírja a kategóriából/típusból/megjegyzésből automatikusan képzett szöveget. */
  title?: string;
}

export function SpecialNeedIcon({ category, needType, needDescription, title, ...props }: SpecialNeedIconProps) {
  const Icon = iconMap[category] ?? HelpOutlineIcon;

  return (
    <Tooltip title={title ?? specialNeedDetailLabel({ category, type: needType, description: needDescription })}>
      <Icon {...props} />
    </Tooltip>
  );
}
