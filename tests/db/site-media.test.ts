import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { ANON, createTestDatabase, queryAs, rpcAs, seedScenario, type Scenario } from "./harness";

interface Media {
  placements: { slot: string; position: number; photo_ref: string; crops: Record<string, unknown> }[];
  photos: { id: string; storage_prefix: string; alt: string }[];
}

let db: PGlite;
let s: Scenario;
let photoId: string;

beforeEach(async () => {
  db = await createTestDatabase();
  s = await seedScenario(db);
  photoId = "11111111-2222-4333-8444-555555555555";
  await queryAs(
    db,
    s.admin,
    `insert into site_photos (id, storage_prefix, format, width, height, widths, alt)
     values ($1::uuid, 'site/photos/' || $1::text, 'webp', 3000, 2000, '{640,1280,1920}', 'Us at the beach')`,
    [photoId],
  );
  await queryAs(
    db,
    s.admin,
    `insert into site_photos (storage_prefix, format, width, height, widths)
     values ('site/photos/99999999-2222-4333-8444-555555555555', 'webp', 10, 10, '{10}')`,
  );
});

describe("site media", () => {
  it("lets admins place photos and the public read only placed ones", async () => {
    await queryAs(
      db,
      s.admin,
      `insert into site_placements (slot, position, photo_ref, crops) values ('home.hero', 0, $1, $2)`,
      [photoId, { desktop: { x: 0.1, y: 0, w: 0.8, h: 0.6 } }],
    );
    await queryAs(
      db,
      s.admin,
      `insert into site_placements (slot, position, photo_ref) values ('gallery', 0, 'bundled:156a0913')`,
    );
    const media = await rpcAs<Media>(db, ANON, "get_site_media");
    expect(media.placements.map((p) => [p.slot, p.photo_ref])).toEqual([
      ["gallery", "bundled:156a0913"],
      ["home.hero", photoId],
    ]);
    expect(media.photos.map((p) => p.alt)).toEqual(["Us at the beach"]); // unplaced photo not exposed
  });

  it("keeps the tables admin-only", async () => {
    await expect(queryAs(db, ANON, `select * from site_photos`)).rejects.toThrow(/permission denied/);
    await expect(queryAs(db, ANON, `select * from site_placements`)).rejects.toThrow(/permission denied/);
    expect(await queryAs(db, s.outsider, `select * from site_photos`)).toEqual([]);
    await expect(
      queryAs(db, s.outsider, `insert into site_placements (slot, photo_ref) values ('home.hero', 'bundled:x')`),
    ).rejects.toThrow(/row-level security/);
  });

  it("rejects malformed references and storage paths", async () => {
    await expect(
      queryAs(db, s.admin, `insert into site_placements (slot, photo_ref) values ('home.hero', '../../etc')`),
    ).rejects.toThrow(/check/);
    await expect(
      queryAs(
        db,
        s.admin,
        `insert into site_photos (storage_prefix, format, width, height, widths) values ('elsewhere/x', 'webp', 1, 1, '{1}')`,
      ),
    ).rejects.toThrow(/check/);
  });

  it("allows one photo per slot position", async () => {
    await queryAs(
      db,
      s.admin,
      `insert into site_placements (slot, position, photo_ref) values ('home.strip', 1, 'bundled:a')`,
    );
    await expect(
      queryAs(
        db,
        s.admin,
        `insert into site_placements (slot, position, photo_ref) values ('home.strip', 1, 'bundled:b')`,
      ),
    ).rejects.toThrow(/site_placements_slot_position_key/);
  });

  it("blocks deleting a library photo that is still placed", async () => {
    await queryAs(db, s.admin, `insert into site_placements (slot, photo_ref) values ('home.story', $1)`, [photoId]);
    await expect(queryAs(db, s.admin, `delete from site_photos where id = $1`, [photoId])).rejects.toThrow(
      /Remove this photo from the site/,
    );
    await queryAs(db, s.admin, `delete from site_placements where photo_ref = $1`, [photoId]);
    await queryAs(db, s.admin, `delete from site_photos where id = $1`, [photoId]);
  });
});
