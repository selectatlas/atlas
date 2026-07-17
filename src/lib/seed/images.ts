import type { SupabaseClient } from "@supabase/supabase-js";

// Each seeded talent gets a hand-picked portrait from the generated pool so
// gender and ethnicity match the persona. Portraits 1-60 live in
// avatars/seed-assets/casting-portrait-unique-XX.png.
const PORTRAIT_BY_EMAIL: Record<string, number> = {
  "priya.singh": 1,
  "ananya.sharma": 8,
  "deepika.nair": 53,
  "kavya.patel": 54,
  "riya.mehta": 55,
  "sunita.joshi": 56,
  "aisha.khan": 7,
  "pooja.verma": 42,
  "zara.ahmed": 57,
  "nisha.rao": 14,
  "sofia.chen": 3,
  "emma.williams": 4,
  "luna.garcia": 6,
  "jade.brown": 2,
  "maya.johnson": 5,
  "amara.osei": 10,
  "chloe.turner": 12,
  "grace.lee": 11,
  "olivia.parker": 9,
  "rosie.thompson": 13,
  "james.morrison": 21,
  "marcus.cole": 23,
  "tom.bradley": 26,
  "ryan.fletcher": 32,
  "daniel.park": 24,
  "luke.harrison": 30,
  "sam.nguyen": 40,
  "alex.bennett": 52,
  "patrick.murphy": 25,
  "kieran.scott": 28,
  "tobias.jones": 31,
  "aaron.patel": 29,
  "sophie.clarke": 16,
  "lauren.webb": 17,
  "emma.rodriguez": 45,
  "charlotte.kim": 15,
  "jessica.hart": 48,
  "mia.thompson": 20,
  "poppy.foster": 58,
  "ava.williams": 51,
  "bella.harris": 18,
  "zoe.adams": 49,
  "lily.evans": 59,
  "iris.murphy": 35,
  "ellie.robinson": 37,
  "freya.wilson": 33,
  "nadia.brown": 19,
  "tia.jackson": 60,
  "theo.brooks.photo": 34,
  "mara.okafor.video": 39,
  "lucas.ferreira.events": 38,
};

function stableIndex(seed: string, count: number): number {
  let hash = 0;
  for (const character of seed)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return (hash % count) + 1;
}

function publicStorageUrl(
  origin: string,
  bucket: "avatars" | "covers",
  path: string,
): string {
  return `${origin.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;
}

// Curated 4K-style fictional casting assets are uploaded once to platform
// storage. Seeded profile media is then copied from there, never hotlinked.
export function seededPortraitUrl(origin: string, seed: string): string {
  const emailPrefix = seed.replace("@atlas-demo.com", "");
  const index = String(
    PORTRAIT_BY_EMAIL[emailPrefix] ?? stableIndex(seed, 52),
  ).padStart(2, "0");
  return publicStorageUrl(
    origin,
    "avatars",
    `seed-assets/casting-portrait-unique-${index}.png`,
  );
}

export function seededCategoryCoverUrl(
  origin: string,
  category:
    "dancer" | "actor" | "photographer_videographer" | "content_creator",
): string {
  const asset = {
    dancer: "casting-banner-dance.png",
    actor: "casting-banner-acting.png",
    photographer_videographer: "casting-banner-visual.png",
    content_creator: "casting-banner-creator.png",
  }[category];
  return publicStorageUrl(origin, "covers", `seed-assets/${asset}`);
}

export function seededCoverUrl(seed: string): string {
  return `https://picsum.photos/seed/${seed}/1600/600`;
}

export function seededPortfolioImageUrl(seed: string): string {
  return `https://picsum.photos/seed/${seed}/1200/800`;
}

// 16:9 job card cover, deterministic per job key so re-runs are stable.
export function seededJobCoverUrl(seed: string): string {
  return `https://picsum.photos/seed/${seed}/1280/720`;
}

interface MirrorOptions {
  bucket: "avatars" | "covers";
  path: string;
  sourceUrl: string;
}

// Downloads sourceUrl and stores it in Supabase storage. Returns the public
// storage URL, or null if the download/upload failed (callers fall back to
// the source URL so an offline seed run still completes).
export async function mirrorImageToStorage(
  supabase: SupabaseClient,
  { bucket, path, sourceUrl }: MirrorOptions,
): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const body = Buffer.from(await response.arrayBuffer());

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, body, { contentType, upsert: true });
    if (error) throw new Error(error.message);

    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.warn(
      `  (image mirror failed for ${sourceUrl}: ${(err as Error).message})`,
    );
    return null;
  }
}
