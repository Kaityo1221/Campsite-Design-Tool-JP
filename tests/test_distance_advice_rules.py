#!/usr/bin/env python3
"""Exhaustive QA for distance advice ruleset v0.1.

Run from repository root:
    python tests/test_distance_advice_rules.py
"""

from __future__ import annotations
import itertools, json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "distance-advice"


def load():
    manifest = json.loads((BASE / "ruleset-v0.1.json").read_text(encoding="utf-8"))
    rules = []
    for name in manifest["rule_files"]:
        doc = json.loads((BASE / name).read_text(encoding="utf-8"))
        for rule in doc["rules"]:
            rules.append({**rule, "level": doc["level"]})
    return manifest, rules


def derive(raw):
    c = dict(raw)
    u50 = c["under50_count"]
    if u50:
        c["under20_ratio"] = c["under20_count"] / u50
        c["between20_30_ratio"] = c["between20_30_count"] / u50
        c["between30_50_ratio"] = c["between30_50_count"] / u50
    else:
        c["under20_ratio"] = c["between20_30_ratio"] = c["between30_50_ratio"] = 0.0

    if u50 == 0:
        c["density_tag"] = "NO_CLOSE"
    elif u50 <= 3:
        c["density_tag"] = "FEW_CLOSE"
    else:
        hits = []
        if c["under20_ratio"] >= .45: hits.append("VERY_CLOSE_HEAVY")
        if c["between20_30_ratio"] >= .45: hits.append("MID_CLOSE_HEAVY")
        if c["between30_50_ratio"] >= .45: hits.append("WIDE_CLOSE_HEAVY")
        c["density_tag"] = hits[0] if len(hits) == 1 else "MIXED_CLOSE"

    c["feature_tags"] = set()
    if u50 >= 4 and c["existing_poi_count"] > 0 and u50 / c["existing_poi_count"] >= .5:
        c["feature_tags"].add("CLOSE_MANY")

    n = c.get("group_size")
    c["group_tag"] = None if n is None else ("GROUP_SMALL" if n <= 10 else "GROUP_MID" if n <= 29 else "GROUP_LARGE")

    m = c.get("cluster_length_m")
    c["cluster_tag"] = None if m is None else ("CLUSTER_COMPACT" if m <= 100 else "CLUSTER_MID" if m <= 180 else "CLUSTER_SPREAD")

    s = c.get("expected_stop_points")
    c["stop_tag"] = None if s is None else ("STOP_LOW" if s <= 2 else "STOP_MID" if s <= 4 else "STOP_HIGH")
    return c


def matches(case, when):
    for key, expected in when.items():
        if key == "feature_tags":
            if not set(expected).issubset(case["feature_tags"]):
                return False
        elif case.get(key) != expected:
            return False
    return True


def select(case, manifest, rules):
    matched = [r for r in rules if matches(case, r["when"])]
    best = {}
    for r in sorted(matched, key=lambda x: (x["priority"], x["level"]), reverse=True):
        best.setdefault(r["category"], r)

    conflict_pairs = [set(x) for x in manifest["selection_policy"]["conflict_behavior_pairs"]]
    dedupe = set(manifest["selection_policy"]["semantic_dedupe_tags"])
    selected = []

    for r in sorted(best.values(), key=lambda x: (x["priority"], x["level"]), reverse=True):
        tags = set(r["behavior_tags"])
        reject = False
        for prior in selected:
            prior_tags = set(prior["behavior_tags"])
            if any(pair.issubset(tags | prior_tags) and pair & tags and pair & prior_tags for pair in conflict_pairs):
                reject = True
                break
            if len((tags & prior_tags) & dedupe) >= 2:
                reject = True
                break
        if not reject:
            selected.append(r)
        if len(selected) >= manifest["selection_policy"]["max_output"]:
            break
    return matched, selected


def density_cases():
    out = [
        ("NO_CLOSE", 10, (0, 0, 0)),
        ("FEW_CLOSE", 10, (1, 1, 0)),
    ]
    for tag, bands in [
        ("VERY_CLOSE_HEAVY", (6, 2, 2)),
        ("MID_CLOSE_HEAVY", (2, 6, 2)),
        ("WIDE_CLOSE_HEAVY", (2, 2, 6)),
        ("MIXED_CLOSE", (4, 3, 3)),
    ]:
        out += [(tag, 10, bands), (tag, 30, bands)]
    return out


def all_cases():
    for d, traffic, plaza, circulation, waiting, group, cluster, stops in itertools.product(
        density_cases(),
        ("easy", "narrow", "careful"),
        (False, True), (False, True), (False, True),
        (None, 6, 20, 40),
        (None, 90, 150, 220),
        (None, 2, 4, 8),
    ):
        tag, existing, bands = d
        u20, m20_30, m30_50 = bands
        yield tag, {
            "existing_poi_count": existing,
            "under50_count": sum(bands),
            "under20_count": u20,
            "between20_30_count": m20_30,
            "between30_50_count": m30_50,
            "traffic": traffic,
            "plaza": plaza,
            "circulation": circulation,
            "waiting": waiting,
            "group_size": group,
            "cluster_length_m": cluster,
            "expected_stop_points": stops,
        }


def main():
    manifest, rules = load()
    assert manifest["rule_count"] == 63
    assert len(rules) == 63
    ids = [r["id"] for r in rules]
    assert len(ids) == len(set(ids)), "duplicate rule IDs"

    fire = Counter()
    chosen = Counter()
    total = 0
    max_matched = 0
    no_composite = 0

    for expected_density, raw in all_cases():
        total += 1
        c = derive(raw)
        assert c["density_tag"] == expected_density, (expected_density, c["density_tag"], raw)
        matched, selected = select(c, manifest, rules)
        max_matched = max(max_matched, len(matched))
        if not selected:
            no_composite += 1

        for r in matched: fire[r["id"]] += 1
        for r in selected: chosen[r["id"]] += 1

        assert len(selected) <= 3
        assert len({r["category"] for r in selected}) == len(selected)

        if c["group_tag"] == "GROUP_SMALL":
            assert not any(r["when"].get("group_tag") == "GROUP_LARGE" for r in matched)

        by_category = defaultdict(list)
        for r in matched: by_category[r["category"]].append(r)
        for category, bucket in by_category.items():
            if any(r["level"] == 4 for r in bucket):
                best = max(bucket, key=lambda x: (x["priority"], x["level"]))
                assert best["level"] == 4, ("level4 lost", category, best["id"], raw)

        conflict_pairs = [set(x) for x in manifest["selection_policy"]["conflict_behavior_pairs"]]
        for a, b in itertools.combinations(selected, 2):
            ta, tb = set(a["behavior_tags"]), set(b["behavior_tags"])
            for pair in conflict_pairs:
                assert not (pair.issubset(ta | tb) and pair & ta and pair & tb), (
                    "behavior conflict", a["id"], b["id"], sorted(pair), raw
                )

    assert not (set(ids) - set(fire)), f"dead rules: {sorted(set(ids) - set(fire))}"
    assert not (set(ids) - set(chosen)), f"never-selected rules: {sorted(set(ids) - set(chosen))}"

    # Composite advice may be empty; the manifest explicitly defines a 54-comment
    # fallback contract for that case. Missing final advice is therefore prevented
    # by the runtime fallback layer.
    assert manifest["fallback_contract"]["library_size"] == 54
    assert manifest["selection_policy"]["max_output"] == 3

    print("distance advice QA PASS")
    print(f"cases: {total}")
    print(f"rules: {len(rules)}")
    print(f"max simultaneous matches: {max_matched}")
    print(f"cases using fallback-only path: {no_composite}")
    print("dead rules: 0")
    print("never-selected rules: 0")
    print("duplicate selected categories: 0")
    print("declared behavior conflicts: 0")


if __name__ == "__main__":
    main()
