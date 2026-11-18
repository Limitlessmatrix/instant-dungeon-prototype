"""Art list for the Instant Dungeon game. Writes art/manifest.json, which a GPU job renders with FLUX.2 klein.

Source: the story "Instant Dungeon" (Medium, 2024-01-29). The story does not describe how anyone looks, so the
character descriptions below are invented here; change them in one place and rerun.

  python art/build_manifest.py
"""
import json
from pathlib import Path

KAI = "Kai, a slim young man in his mid twenties with short messy black hair and tired grey eyes"
KAI_OFFICE = KAI + ", wearing a white office shirt and a loose dark tie"
KAI_WORLD = KAI + ", wearing a white shirt with rolled sleeves and dark trousers"
ERIS = ("Eris, a fierce young woman warrior with a long crimson braid and amber eyes, dark leather armor with "
        "steel pauldrons, a longsword")
ZEPHYR = ("Zephyr, a relaxed young man with tousled silver-white hair and teal eyes, a long green traveler's coat "
          "and a satchel of scrolls")
PANEL = (" Anime key visual, isekai fantasy story illustration, clean line art, soft cel shading, cinematic "
         "lighting, detailed background, widescreen composition. No text, no captions, no watermark.")
SPRITE = (" Chibi video game character sprite, full body, standing, facing the viewer, three-quarter top-down RPG "
          "view, flat colors, bold dark outline, centered, the whole figure in frame with margin, plain solid white "
          "background, no ground shadow, no text.")
OBJECT = (" Single video game item sprite, three-quarter top-down RPG view, flat colors, bold dark outline, centered, "
          "whole object in frame with margin, plain solid white background, no ground shadow, no text.")
TILE = (" Top-down video game ground texture, viewed straight from above, flat even lighting, fills the whole "
        "image edge to edge, no perspective, no horizon, no objects, no characters, no text.")
PORTRAIT = (" Anime character portrait, head and shoulders, facing the viewer, soft cel shading, simple dark "
            "blurred background. No text.")

PANELS = [
    ("p00", f"Title illustration: {KAI_WORLD}, seen from behind, standing in a glowing grassy field in front of a "
            "dungeon gate made of vines and stone, an alien pastel sky above, distant mountains."),
    ("p01", f"Morning in a small cluttered apartment, sunlight through window blinds, {KAI} in a t-shirt reaching "
            "from his bed to silence a ringing alarm clock."),
    ("p02", f"{KAI_OFFICE}, typing at a computer in a grey office cubicle among rows of identical cubicles."),
    ("p03", f"{KAI_OFFICE}, staring past his monitor in a cubicle, faint translucent fantasy castles and dragons "
            "drifting above his head as a daydream."),
    ("p04", f"{KAI_OFFICE}, sitting alone at a cafe window table with a sandwich and a coffee, watching people "
            "walk by on the street outside."),
    ("p05", f"Close view of a small sketchbook with pencil sketches of passers-by, the hand of {KAI_OFFICE} "
            "drawing, a coffee cup beside it on a cafe table."),
    ("p06", f"A friendly barista in an apron chatting across the counter with {KAI_OFFICE}, who smiles shyly."),
    ("p07", f"{KAI_OFFICE}, leaving an office building in late afternoon, glancing over his shoulder at a small "
            "strange flicker of light at the edge of a busy city street."),
    ("p08", f"{KAI_OFFICE}, sitting alone on a park bench under trees at golden hour, people in the distance."),
    ("p09", f"View from behind {KAI_OFFICE} on a park bench, watching a group of friends play basketball on a "
            "court, wistful mood."),
    ("p10", f"Night, a dark room lit by a monitor, {KAI} in a hoodie with a game controller, a fantasy game and "
            "a chat window glowing on screen."),
    ("p11", f"{KAI} in a hoodie at his apartment window at night, looking up at a starry sky over the city."),
    ("p12", f"A city crossing in the morning with something subtly wrong, flickering street lights and startled "
            f"birds, {KAI_OFFICE} walking among commuters and looking around uneasily."),
    ("p13", f"A dramatic moment at a city crosswalk: {KAI_OFFICE} lunging forward with both arms out to push a "
            "young mother and her small child to safety, bright headlights of a speeding car behind him, motion "
            "blur. No impact shown."),
    ("p14", "City street sounds fading: an empty crosswalk dissolving into soft white light and drifting "
            "particles, a dropped office bag on the ground, quiet and still."),
    ("p15", f"{KAI_WORLD}, standing up dazed in an open grassy field under an alien sky painted in teal, pink "
            "and gold, two pale moons."),
    ("p16", f"Wide landscape: {KAI_WORLD}, small in the frame, looking at towering strange mountains and floating "
            "rocks far across a fantasy plain."),
    ("p17", f"A small fluffy rabbit with feathered wings hopping past the feet of a surprised {KAI_WORLD} in "
            "tall grass."),
    ("p18", f"{KAI_WORLD}, leaping impossibly high above a meadow with a delighted grin, arms spread, wind lines."),
    ("p19", f"{KAI_WORLD}, holding out his open hands in wonder, a small swirl of fire, water and wind light "
            "spinning above his palms."),
    ("p20", f"An ancient structure of woven vines and mossy stones pulsing with a warm inviting glow, a dark "
            f"doorway in it, {KAI_WORLD} approaching through the grass."),
    ("p21", f"Inside a maze of living vine walls and stone floors lit by glowing runes, the walls shifting, "
            f"{KAI_WORLD} studying a riddle carved on a stone tablet."),
    ("p22", f"{KAI_WORLD}, kneeling at an opened treasure chest in a vine covered chamber, lifting out a glowing "
            "crystal artifact, an old parchment map in his other hand."),
    ("p23", f"Outside a dungeon in a forest clearing, {ERIS}, arguing with {ZEPHYR}, who shrugs with a grin."),
    ("p24", f"Comedy scene: {KAI_WORLD}, {ERIS}, and {ZEPHYR}, all three tangled together in a rope net trap on "
            "the forest floor, annoyed and embarrassed faces."),
    ("p25", f"{KAI_WORLD}, {ERIS}, and {ZEPHYR}, standing together on a forest path at sunset, an uneasy new "
            "team, Eris with arms crossed, Zephyr smiling."),
    ("p26", f"A daunting gothic dungeon entrance of black stone, pointed arches and iron gates under a grey sky, "
            f"three small figures before it: {KAI_WORLD}, {ERIS}, and {ZEPHYR}."),
    ("p27", f"Inside a gothic dungeon, three parallel stone corridors divided by walls seen in cutaway, "
            f"{KAI_WORLD}, in one, {ERIS}, in the next, {ZEPHYR}, in the third, each beside a glowing floor plate."),
    ("p28", "The heart of a gothic dungeon: a massive horned guardian of black stone and shadow with a glowing "
            "violet core in its chest towering over three small adventurers in a pillared hall."),
    ("p29", f"After the battle, {KAI_WORLD}, {ERIS}, and {ZEPHYR}, resting around a small campfire outside the "
            "dungeon at dusk, tired and smiling, talking."),
    ("p30", "A fantasy landscape under a sky turning sinister: dark swirling clouds forming a huge crackling "
            "vortex, long twisted shadows on the ground, three small figures looking up."),
    ("p31", "High on a distant hill, a lone hooded figure in a dark tattered cloak, face hidden, watching the "
            "valley far below under a storm vortex."),
    ("p32", f"Close on {KAI_WORLD}, looking up at a storm sky with a determined glint in his eyes, wind in his "
            "hair, the vortex reflected in them."),
]

SPRITES = [
    ("kai", KAI_WORLD + "." + SPRITE),
    ("eris", ERIS + "." + SPRITE),
    ("zephyr", ZEPHYR + "." + SPRITE),
    ("rabbit", "A small fluffy white rabbit with feathered wings." + SPRITE),
    ("boar", "A bristly wild fantasy boar with glowing blue tusks, angry." + SPRITE),
    ("slime", "A green slime creature wrapped in small leafy vines, two simple eyes." + SPRITE),
    ("bat", "A dark purple cave bat with red eyes, wings spread." + SPRITE),
    ("knight", "A skeleton knight in rusted gothic armor holding a shield and a mace." + SPRITE),
    ("boss", "A massive horned guardian golem of black stone and shadow with a glowing violet core in its chest." + SPRITE),
    ("chest", "A closed wooden treasure chest with iron bands." + OBJECT),
    ("chest_open", "An open wooden treasure chest with iron bands, golden light inside." + OBJECT),
    ("artifact", "A glowing faceted crystal artifact wrapped in a ring of gold." + OBJECT),
    ("map", "A rolled old parchment map tied with a red ribbon." + OBJECT),
    ("lever", "A stone pedestal with a brass lever." + OBJECT),
    ("orb", "A round glowing rune stone orb on a short stone pedestal." + OBJECT),
    ("door_vine", "A square gate made of thick woven vines, seen from the front." + OBJECT),
    ("door_iron", "A square gothic iron portcullis gate, seen from the front." + OBJECT),
    ("net", "A rope net trap spread flat on the ground." + OBJECT),
]

PORTRAITS = [("kai", KAI_WORLD), ("eris", ERIS), ("zephyr", ZEPHYR)]

TILES = [
    ("grass", "Lush green meadow grass with tiny scattered wildflowers."),
    ("path", "A worn dirt path with small pebbles."),
    ("vine_floor", "Old mossy stone floor slabs with thin vines growing in the cracks."),
    ("vine_wall", "A dense wall of thick woven dark green vines and leaves."),
    ("goth_floor", "Dark grey gothic flagstone floor, worn and cracked."),
    ("goth_wall", "Black gothic stone bricks with carved trim."),
    ("plate", "A square stone pressure plate with a glowing blue rune carved in the middle."),
    ("water", "Clear shallow turquoise water with soft ripples."),
]


def main():
    items = []
    for i, p in PANELS:
        items.append({"id": i, "kind": "panel", "w": 1280, "h": 720, "prompt": p + PANEL})
    for i, p in SPRITES:
        items.append({"id": i, "kind": "sprite", "w": 768, "h": 768, "variants": 2, "prompt": p})
    for i, p in PORTRAITS:
        items.append({"id": i, "kind": "portrait", "w": 768, "h": 768, "prompt": p + "." + PORTRAIT})
    for i, p in TILES:
        items.append({"id": i, "kind": "tile", "w": 512, "h": 512, "prompt": p + TILE})
    ids = [(x["kind"], x["id"]) for x in items]
    assert len(ids) == len(set(ids))
    out = Path(__file__).resolve().parent / "manifest.json"
    out.write_text(json.dumps({"game": "instant-dungeon", "rev": "a1", "items": items}, indent=1), encoding="utf-8", newline="\n")
    print(out, len(items), "items,", sum(x.get("variants", 1) for x in items), "images")


if __name__ == "__main__":
    main()
