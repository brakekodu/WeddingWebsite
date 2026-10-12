import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { ANON, createTestDatabase, queryAs, rpcAs, seedScenario, type Scenario } from "./harness";

let db: PGlite;
let s: Scenario;

beforeEach(async () => {
  db = await createTestDatabase();
  s = await seedScenario(db);
});

const save = (actor: Scenario["admin"], section: string, value: unknown) =>
  queryAs(db, actor, `select public.save_site_content_section($1, $2::jsonb)`, [
    section,
    value === null ? null : JSON.stringify(value),
  ]);

describe("site content", () => {
  it("starts empty and lets the public read what admins save", async () => {
    expect(await rpcAs(db, ANON, "get_site_content")).toEqual({});

    await save(s.admin, "home", { welcome: "Hello!", rsvpPrompt: "Join us?" });
    await save(s.admin, "gallery", { intro: "Photos" });
    expect(await rpcAs(db, ANON, "get_site_content")).toEqual({
      home: { welcome: "Hello!", rsvpPrompt: "Join us?" },
      gallery: { intro: "Photos" },
    });

    // Saving one section leaves the others alone; null resets a section.
    await save(s.admin, "home", { welcome: "Hi again", rsvpPrompt: "Join us?" });
    await save(s.admin, "gallery", null);
    expect(await rpcAs(db, ANON, "get_site_content")).toEqual({
      home: { welcome: "Hi again", rsvpPrompt: "Join us?" },
    });

    const [row] = await queryAs<{ updated_by: string }>(db, s.admin, `select updated_by from site_content`);
    expect(row.updated_by).toBe((s.admin as { userId: string }).userId);
  });

  it("keeps the table admin-only", async () => {
    await expect(queryAs(db, ANON, `select * from site_content`)).rejects.toThrow(/permission denied/);
    await expect(save(ANON, "home", { welcome: "x" })).rejects.toThrow(/permission denied/);

    expect(await queryAs(db, s.outsider, `select * from site_content`)).toEqual([]);
    await expect(save(s.outsider, "home", { welcome: "Hacked" })).rejects.toThrow(/not_authorized/);
    expect(await queryAs(db, s.outsider, `update site_content set content = '{"x":1}'`)).toEqual([]);
    expect(await rpcAs(db, ANON, "get_site_content")).toEqual({});
  });

  it("allows exactly one row and rejects malformed saves", async () => {
    await expect(queryAs(db, s.admin, `insert into site_content (id) values (true)`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(queryAs(db, s.admin, `delete from site_content`)).rejects.toThrow(/permission denied/);
    await expect(save(s.admin, "Bad Section", { a: 1 })).rejects.toThrow(/invalid_section/);
    await expect(save(s.admin, "home", ["not", "an", "object"])).rejects.toThrow(/invalid_section_value/);
  });
});
