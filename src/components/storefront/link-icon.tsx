import {
  Camera,
  Disc3,
  Globe,
  Link2,
  Mail,
  MessageCircle,
  Phone,
  Play,
  ShoppingBag,
} from "lucide-react";
import type { ComponentType } from "react";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  instagram: Camera,
  tiktok: Disc3,
  whatsapp: MessageCircle,
  tokopedia: ShoppingBag,
  shopee: ShoppingBag,
  youtube: Play,
  email: Mail,
  phone: Phone,
  website: Globe,
};

export function LinkIcon({ icon, className }: { icon: string | null; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Link2;
  return <Icon className={className} />;
}
