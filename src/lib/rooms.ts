import { Atom, Wrench, GraduationCap, ShoppingBag, Calculator, Sparkles, MessageCircle } from "lucide-react";

export const VERSION = "v0.0.0.13";
export const rooms = [
  { slug: "explore", name: "Explore & Learn", color: "#7166dc", icon: Atom },
  { slug: "tutorial", name: "Tutorial & Problem Solve", color: "#e68c55", icon: Wrench },
  { slug: "school", name: "Madevi School", color: "#559e7d", icon: GraduationCap },
  { slug: "shop", name: "Madevi Shop", color: "#e1788b", icon: ShoppingBag },
  { slug: "tools", name: "Tools & Equipment", color: "#5c97c8", icon: Calculator },
  { slug: "services", name: "Madevi Services", color: "#c49a4b", icon: Sparkles },
  { slug: "line", name: "Madevi Line", color: "#ad76b8", icon: MessageCircle },
] as const;

