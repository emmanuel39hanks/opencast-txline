/**
 * Single import surface for Iconsax UI icons used across the landing page.
 *
 * Re-exporting here means components don't have to remember each icon's
 * exact name from `iconsax-react` — and we can swap to a different icon set
 * later by changing this file alone.
 *
 * All icons accept the standard Iconsax props: `size`, `color`, `variant`
 * (Linear | Outline | Bold | Bulk | Broken | TwoTone). Default in this app:
 * `variant="Bold"` for category indicators, `variant="Linear"` for actions.
 */

export {
  // Category indicators (used in market cards instead of emojis)
  Bitcoin as IconCrypto,
  Gameboy as IconSports,
  Sun1 as IconWeather,
  Note1 as IconNews,
  Building3 as IconPolitics,
  VideoPlay as IconEntertainment,

  // Action / nav
  ArrowRight as IconArrowRight,
  ArrowDown2 as IconChevronDown,
  Add as IconPlus,
  CloseCircle as IconClose,
  TickCircle as IconCheck,
  TickSquare as IconTickSquare,
  Wallet as IconWallet,
  Wallet2 as IconWalletSolid,
  Flash as IconFlash,
  Magicpen as IconMagic,
  ShieldTick as IconShield,
  Cup as IconTrophy,
  Chart as IconChart,
  Coin as IconCoin,
  Activity as IconActivity,
  DollarSquare as IconDollar,
  Star1 as IconStar,
  TrendUp as IconTrendUp,
  Cpu as IconCpu,
  Link as IconLink,
  Receipt21 as IconReceipt,
  Eye as IconEye,
  Crown as IconCrown,
} from "iconsax-react";
