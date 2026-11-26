import { MegaphoneIcon, QrCodeIcon, TicketCheckIcon, UsersIcon } from "lucide-react";

export const STAFF_TABS = [
  { to: "/admin/redeem", label: "Redeem", icon: TicketCheckIcon },
  { to: "/admin/contacts", label: "Contacts", icon: UsersIcon },
  { to: "/admin/campaigns", label: "Campaigns", icon: MegaphoneIcon },
  { to: "/admin/qr", label: "QR card", icon: QrCodeIcon },
] as const;
