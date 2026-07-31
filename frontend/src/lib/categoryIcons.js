import { ImageIcon, WatchIcon, TvIcon, VacuumIcon, FridgeIcon } from "../components/icons";

export const CATEGORY_ICONS = {
  Smartphone: ImageIcon,
  Wearable: WatchIcon,
  Television: TvIcon,
  Vacuum: VacuumIcon,
  Appliance: FridgeIcon,
};

export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || ImageIcon;
}
