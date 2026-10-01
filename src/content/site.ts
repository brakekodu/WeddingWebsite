/**
 * Website content — the words and details guests read.
 *
 * Everything in [square brackets] is a placeholder still to be filled in.
 * Events (times, venues, attire) are NOT here: they come from Admin → Events,
 * and only events marked Public appear on the public site. The RSVP deadline
 * comes from Admin → Settings.
 */

export const site = {
  couple: {
    first: "Kevin",
    second: "Sarina",
    /** Shown top-left until the real monogram artwork exists. */
    monogram: "K & S",
  },

  /** The wedding day as YYYY-MM-DD. Drives the countdown; null hides it. */
  weddingDate: null as string | null,
  /** How the date reads in the hero, e.g. "Saturday, June 12, 2027". */
  dateLabel: "[Saturday, Month Day, Year]",
  /** Weekend span for the Weekend page header, e.g. "June 11–13, 2027". */
  weekendLabel: "[Month Day–Day, Year]",
  location: "[City, State]",

  contactEmail: "[couple email]",
  /** Day-of contact shown in the guest portal. */
  dayOfContact: "[Coordinator name] · [phone]",

  home: {
    welcome: "[Two or three sentences welcoming guests and setting the tone for the weekend.]",
    rsvpPrompt: "Will you join us?",
  },

  story: {
    title: "[How it started]",
    teaser: "[Two-line story teaser — three or four lines on desktop.]",
    sections: [
      { title: "How we met", body: "[A few paragraphs about how you met.]" },
      { title: "The proposal", body: "[The proposal story.]" },
    ],
    weddingParty: [
      { name: "[Name]", role: "Maid of Honor", blurb: "[One line about them.]" },
      { name: "[Name]", role: "Best Man", blurb: "[One line about them.]" },
      { name: "[Name]", role: "Bridesmaid", blurb: "[One line about them.]" },
      { name: "[Name]", role: "Groomsman", blurb: "[One line about them.]" },
    ],
  },

  weekend: {
    intro: "Invited to more? Your personal schedule — including any private events — is on your invitation link.",
    goodToKnow: [
      { label: "Attire", body: "[Dress code guidance]" },
      { label: "Weather", body: "[Typical temps · indoor/outdoor note]" },
      { label: "Unplugged ceremony", body: "[Phones away request]" },
    ],
  },

  travel: {
    intro: "[One line: where the wedding is and the single most important travel tip.]",
    roomBlockDeadline: "[date]",
    hotels: [
      {
        name: "[Hotel A]",
        tag: "Primary room block · shuttle stop",
        details: "[x] min to venue · from $[rate]/night",
        code: "[CODE]",
        until: "[date]",
        url: "#",
      },
      {
        name: "[Hotel B]",
        tag: "Second block",
        details: "[x] min to venue · from $[rate]/night",
        code: "[CODE]",
        until: "[date]",
        url: "#",
      },
    ],
    otherOptions: "[Neighborhood suggestions for groups or longer stays]",
    airports: [
      {
        label: "Recommended",
        name: "[Airport name] ([CODE])",
        note: "[x] min drive to hotels · [airlines / direct routes note]",
      },
      { label: "Alternative", name: "[Airport name] ([CODE])", note: "[x] min drive · [why you'd choose it]" },
    ],
    shuttles: [
      { label: "To ceremony", from: "[Hotel A]", to: "[Venue]", times: "3:45 PM · 4:05 PM" },
      { label: "Return", from: "[Venue]", to: "[Hotel A]", times: "10:00 PM · 11:00 PM · 12:00 AM" },
    ],
    parking: "[Venue parking details]",
    rideshare: "[Pickup point and tips]",
    thingsToDo: [
      { name: "[Our favorite restaurant]", why: "[One line why]" },
      { name: "[Coffee / brunch spot]", why: "[One line why]" },
      { name: "[Thing to see]", why: "[One line why]" },
    ],
  },

  gallery: {
    intro: "Engagement photos. After the wedding, this is where everyone's photos will live.",
    /** Files in /public/gallery, e.g. { src: "/gallery/01.jpg", alt: "…" }. Empty shows placeholders. */
    photos: [] as { src: string; alt: string }[],
  },

  registry: {
    intro:
      "[Your presence is the greatest gift. For those who'd like to celebrate with something more, we've put together a few ideas.]",
    items: [
      {
        provider: "[Registry provider A]",
        description: "[What's on it — home, kitchen…]",
        url: "#",
        cta: "View registry",
      },
      { provider: "[Registry provider B]", description: "[What's on it]", url: "#", cta: "View registry" },
      {
        provider: "Honeymoon fund",
        description: "[Where you're headed and what contributions go toward]",
        url: "#",
        cta: "Contribute",
      },
    ],
    mailingNote: "Sending something by mail? Please ship to [address] — not the venue.",
  },

  faq: [
    {
      topic: "RSVP",
      items: [
        { q: "When is the RSVP deadline?", a: "[Answer — the deadline also appears on your invitation page.]" },
        {
          q: "Can we change our RSVP?",
          a: "Yes — open your invitation link (or scan the QR code again) and choose Edit RSVP before the deadline.",
        },
        { q: "Lost your invitation?", a: "Email us and we'll send your link." },
      ],
    },
    {
      topic: "Attire",
      items: [{ q: "What should I wear?", a: "[Answer text.]" }],
    },
    {
      topic: "Kids & plus-ones",
      items: [
        { q: "Are kids invited?", a: "[Answer text.]" },
        { q: "Can I bring a guest?", a: "[Answer text — your invitation shows whether a guest is included.]" },
      ],
    },
    {
      topic: "Travel",
      items: [
        { q: "Is there a hotel room block?", a: "[Answer text.]" },
        { q: "Is there parking at the venue?", a: "[Answer text.]" },
      ],
    },
    {
      topic: "Day-of",
      items: [{ q: "Who do we contact on the day?", a: "[Coordinator name and phone.]" }],
    },
  ],
};

export const coupleNames = `${site.couple.first} & ${site.couple.second}`;

/** The first few questions, for the Home and portal previews. */
export function faqPreview(count = 4) {
  return site.faq.flatMap((g) => g.items).slice(0, count);
}
