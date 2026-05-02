import type { ComponentType, SVGProps } from "react";

import {
  AccountIcon,
  AlertsIcon,
  AnalyticsIcon,
  BlogIcon,
  DashboardIcon,
  MapIcon,
  NewsIcon,
  RolesIcon,
  SensorsIcon,
  SettingsIcon,
} from "@/components/icons/NavIcons";
import type { AppNavIconKey } from "@/lib/permissions";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

export const crmNavIconMap: Record<AppNavIconKey, IconComp> = {
  dashboard: DashboardIcon,
  sensors: SensorsIcon,
  map: MapIcon,
  analytics: AnalyticsIcon,
  alerts: AlertsIcon,
  community: BlogIcon,
  news: NewsIcon,
  roles: RolesIcon,
  account: AccountIcon,
  settings: SettingsIcon,
};
