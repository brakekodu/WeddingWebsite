import type { NavItem } from "@/components/site/site-header";

/** Primary navigation: 6 links + RSVP (no dropdowns). */
export const PUBLIC_NAV: NavItem[] = [
  { href: "/story", label: "Our Story" },
  { href: "/weekend", label: "Weekend" },
  { href: "/travel", label: "Travel & Stay" },
  { href: "/gallery", label: "Gallery" },
  { href: "/registry", label: "Registry" },
  { href: "/faq", label: "FAQ" },
];

/** Personalized navigation inside the guest portal. */
export function portalNav(token: string): NavItem[] {
  return [
    { href: `/i/${token}#weekend`, label: "Your weekend" },
    { href: "/travel", label: "Travel & Stay" },
    { href: "/registry", label: "Registry" },
    { href: "/faq", label: "FAQ" },
    { href: "/story", label: "Our Story" },
  ];
}
