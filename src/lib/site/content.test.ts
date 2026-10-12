import { describe, expect, it } from "vitest";
import { siteDefaults, type SiteSection } from "@/content/site";
import { hasPlaceholder, parseSection, resolveSiteContent, SITE_SECTIONS, weddingDateOf } from "./content";

const hotel = (url: string) => ({ ...siteDefaults.travel.hotels[0], url });

describe("site content", () => {
  it("describes every section, and every default passes its own rules", () => {
    expect(SITE_SECTIONS.map((s) => s.key).sort()).toEqual(Object.keys(siteDefaults).sort());
    for (const key of Object.keys(siteDefaults) as SiteSection[]) {
      const parsed = parseSection(key, siteDefaults[key]);
      expect(parsed, key).toEqual({ ok: true, value: siteDefaults[key] });
    }
  });

  it("uses defaults for anything not saved or not valid", () => {
    expect(resolveSiteContent(null)).toEqual(siteDefaults);
    expect(resolveSiteContent("nope")).toEqual(siteDefaults);
    expect(resolveSiteContent({ home: "nope", other: { a: 1 } })).toEqual(siteDefaults);

    const content = resolveSiteContent({
      home: { welcome: "  Welcome, friends!  ", rsvpPrompt: "Join us?", extra: "dropped" },
      travel: { ...siteDefaults.travel, hotels: [hotel("javascript:alert(1)")] },
    });
    expect(content.home).toEqual({ welcome: "Welcome, friends!", rsvpPrompt: "Join us?" });
    expect(content.travel).toEqual(siteDefaults.travel); // unsafe link: whole section falls back
  });

  it("keeps defaults for fields a saved section doesn't have yet", () => {
    const content = resolveSiteContent({ home: { welcome: "Hi" } });
    expect(content.home).toEqual({ welcome: "Hi", rsvpPrompt: siteDefaults.home.rsvpPrompt });
    const story = resolveSiteContent({ story: { ...siteDefaults.story, sections: [{ title: "Only a title" }] } });
    expect(story.story.sections).toEqual([{ title: "Only a title", body: "" }]);
  });

  it("only allows safe links", () => {
    const ok = (url: string) => parseSection("travel", { ...siteDefaults.travel, hotels: [hotel(url)] }).ok;
    expect(ok("https://www.marriott.com/book?x=1")).toBe(true);
    expect(ok("#")).toBe(true);
    expect(ok("")).toBe(true);
    expect(ok("mailto:us@example.com")).toBe(true);
    expect(ok("javascript:alert(1)")).toBe(false);
    expect(ok("data:text/html,hi")).toBe(false);
    expect(ok("www.example.com")).toBe(false);
    expect(ok('https://x.com/"onmouseover=')).toBe(false);
  });

  it("checks dates, emails, lengths, and list sizes", () => {
    const basics = (over: object) => parseSection("basics", { ...siteDefaults.basics, ...over });
    expect(basics({ weddingDate: "2027-06-12" }).ok).toBe(true);
    expect(basics({ weddingDate: "" }).ok).toBe(true);
    expect(basics({ weddingDate: "2027-02-30" }).ok).toBe(false);
    expect(basics({ weddingDate: "June 12" }).ok).toBe(false);
    expect(basics({ contactEmail: "us@example.com" }).ok).toBe(true);
    expect(basics({ contactEmail: "not an email" })).toEqual({
      ok: false,
      message: "Contact email must be an email address.",
    });
    expect(basics({ location: "x".repeat(201) }).ok).toBe(false);
    expect(basics({ location: "bad\u0000char" }).ok).toBe(false);

    const tooMany = Array.from({ length: 13 }, () => ({ title: "t", body: "b" }));
    expect(parseSection("story", { ...siteDefaults.story, sections: tooMany }).ok).toBe(false);
  });

  it("normalizes line breaks and reads the wedding date", () => {
    const parsed = parseSection("home", { welcome: "One\r\nTwo", rsvpPrompt: "Hi" });
    expect(parsed).toEqual({ ok: true, value: { welcome: "One\nTwo", rsvpPrompt: "Hi" } });
    expect(weddingDateOf(siteDefaults)).toBeNull();
    expect(weddingDateOf({ ...siteDefaults, basics: { ...siteDefaults.basics, weddingDate: "2027-06-12" } })).toBe(
      "2027-06-12",
    );
  });

  it("spots placeholders", () => {
    expect(hasPlaceholder("[Hotel A]")).toBe(true);
    expect(hasPlaceholder("from $[rate]/night")).toBe(true);
    expect(hasPlaceholder("Hotel A")).toBe(false);
    expect(hasPlaceholder("[]")).toBe(false);
  });
});
