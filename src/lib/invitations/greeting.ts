export interface NamedGuest {
  first_name: string;
  last_name?: string | null;
  display_name?: string | null;
}

/** The name we greet a guest by: their preferred name, else first name. */
export function greetingName(guest: NamedGuest): string {
  return guest.display_name?.trim() || guest.first_name.trim();
}

/** ["John"] -> "John"; ["John","Sarah"] -> "John & Sarah"; ["A","B","C"] -> "A, B & C". */
export function joinNames(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? "";
  return `${clean.slice(0, -1).join(", ")} & ${clean[clean.length - 1]}`;
}

/** "Welcome, John & Sarah." */
export function formatGreeting(guests: NamedGuest[]): string {
  const names = joinNames(guests.map(greetingName));
  return names ? `Welcome, ${names}.` : "Welcome.";
}

/** Legal-style name for admin screens: "John Smith". */
export function fullName(guest: NamedGuest): string {
  return [guest.first_name.trim(), guest.last_name?.trim()].filter(Boolean).join(" ");
}
