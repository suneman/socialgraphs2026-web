# Course data — the shared playground

Frozen snapshots of the Marvel-superheroes Wikipedia corpus, released in stages.
**`index.html` is the student-facing page** (GitHub Pages serves no directory
listings) — file table, loading snippet, provenance. Keep the two in sync.

| File | Arrives | What |
|---|---|---|
| `week1_edges.tsv` + `week1_nodes.tsv` | week 1 ✅ | unweighted directed edge list + full node roster (303 nodes, 1,784 edges; snapshot 2026-08-26) |
| (weighted edition) | ~week 3 | directed edges + repeat counts |
| (bipartite edition) | ~week 4 | pages × people |
| (raw text) | week 5 | **NOT in git** — hosted on DTU storage, only the link goes on `index.html` |

Snapshots are frozen so everyone computes on identical data; Wikipedia itself moves on.
Released node files carry identity only (name, Wikidata id, URL, blurb) — never
precomputed degrees or statistics; computing those is the students' exercise.

**Size rule (Sune, 2026-08-26): no big files in git, ever.** This folder holds small
TSV snapshots (≲ a few MB). Anything bigger — the raw-text corpus above all — lives on
DTU storage and is linked from `index.html`. Also: only *released* snapshots belong in
this folder (`publish.sh` ships it wholesale) — stage upcoming editions elsewhere until
their week.

Source pipeline (reproducible, private): `~/git/experiments/wiki-crawl`, run as
`./run_all.sh <dataset>` (outputs in `output/marvel_superheroes/`) — see its README
for the extraction decisions (wikitext links, not template navboxes; redirects
resolved via Wikidata). The corpus was computer scientists for a few hours on
2026-08-26; swapped to Marvel for density (median degree 6 vs 1).
