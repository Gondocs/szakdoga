import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AccessibleForwardIcon from '@mui/icons-material/AccessibleForward';
import ChildFriendlyIcon from '@mui/icons-material/ChildFriendly';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import PetsIcon from '@mui/icons-material/Pets';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import type { SvgIconProps } from '@mui/material';
import type { SpecialNeedCategory } from '../../types';

const iconMap: Record<SpecialNeedCategory, typeof LocalHospitalIcon> = {
  medical: LocalHospitalIcon,
  mobility: AccessibleForwardIcon,
  age: ChildFriendlyIcon,
  diet: RestaurantIcon,
  animal: PetsIcon,
  other: HelpOutlineIcon,
};

export function SpecialNeedIcon({ category, ...props }: { category: SpecialNeedCategory } & SvgIconProps) {
  const Icon = iconMap[category] ?? HelpOutlineIcon;
  return <Icon {...props} />;
}
