#!/usr/bin/env python3
"""Fetch fresh county parcel data for the IGCE Site Screener.

Run this on YOUR machine (the Claude sandbox can't reach county GIS servers).
It reads every parcel PIN out of sitescreener/data.js, queries the county's
public ArcGIS FeatureServer (and optionally a Socrata dataset) in chunks, and
writes a merge-ready county_enrich.json keyed by PIN. Send that file back in
chat and the screener's DATA/ENRICH records get refreshed from it.

Usage
-----
1) Find the layer URL. For Fairfax County parcels, browse
   https://data.fairfaxcounty.gov/ or https://www.fairfaxcounty.gov/maps/open-geospatial-data
   and locate the "Parcels" / "Real Estate - Parcels" FeatureServer layer.
   The URL ends in ".../FeatureServer/0" or ".../MapServer/0".
   Alexandria: https://www.alexandriava.gov/GIS (parcel layer on their ArcGIS).

2) Discover the field names (prints the layer's schema and exits):
     python3 scripts/fetch_county_data.py --url <LAYER_URL> --list-fields

3) Fetch, telling it which field holds the parcel PIN:
     python3 scripts/fetch_county_data.py --url <LAYER_URL> --pin-field PIN \
         --fields "PIN,ADDRESS,ZONING,LAND_SF,BLDG_SF,YEAR_BUILT,ASSESSED_TOTAL" \
         --out county_enrich.json

   Omit --fields to pull every field. PINs that the layer can't match are
   listed in the output under "_unmatched".

4) Socrata alternative (data.fairfaxcounty.gov datasets, URL like
   https://data.fairfaxcounty.gov/resource/XXXX-XXXX.json):
     python3 scripts/fetch_county_data.py --socrata <RESOURCE_URL> --pin-field parcel_pin

Only the Python standard library is required.
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request

DATA_JS = "sitescreener/data.js"
CHUNK = 100          # PINs per query (keeps the WHERE clause under URL limits)
RETRIES = 3


def read_pins(path=DATA_JS):
    """Pull every "pin":"..." value out of data.js (DATA and EXTRA records)."""
    with open(path, encoding="utf-8") as f:
        src = f.read()
    pins = re.findall(r'"pin"\s*:\s*"([^"]+)"', src)
    # de-dup, preserve order
    seen, out = set(), []
    for p in pins:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def http_json(url, data=None):
    last = None
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(
                url,
                data=data.encode() if isinstance(data, str) else data,
                headers={"User-Agent": "igce-sitescreener/1.0"},
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except Exception as e:  # noqa: BLE001 - report and retry
            last = e
            time.sleep(2 * (attempt + 1))
    raise SystemExit(f"request failed after {RETRIES} tries: {url}\n  {last}")


# ---------------------------------------------------------------- ArcGIS ----

def arcgis_fields(layer_url):
    meta = http_json(layer_url.rstrip("/") + "?f=json")
    return meta.get("fields", []), meta.get("name", "?")


def arcgis_query(layer_url, where, out_fields):
    params = urllib.parse.urlencode({
        "where": where,
        "outFields": out_fields,
        "returnGeometry": "false",
        "f": "json",
    })
    # POST keeps long WHERE clauses off the URL
    j = http_json(layer_url.rstrip("/") + "/query", data=params)
    if "error" in j:
        raise SystemExit(f"ArcGIS error: {j['error']}")
    return [f.get("attributes", {}) for f in j.get("features", [])]


def fetch_arcgis(layer_url, pins, pin_field, out_fields):
    result = {}
    for i in range(0, len(pins), CHUNK):
        chunk = pins[i:i + CHUNK]
        quoted = ",".join("'" + p.replace("'", "''") + "'" for p in chunk)
        where = f"{pin_field} IN ({quoted})"
        for attrs in arcgis_query(layer_url, where, out_fields):
            pin = str(attrs.get(pin_field, "")).strip()
            if pin:
                result[pin] = attrs
        print(f"  {min(i + CHUNK, len(pins))}/{len(pins)} PINs queried, "
              f"{len(result)} matched", file=sys.stderr)
    return result


# --------------------------------------------------------------- Socrata ----

def fetch_socrata(resource_url, pins, pin_field):
    result = {}
    base = resource_url.split("?")[0]
    for i in range(0, len(pins), CHUNK):
        chunk = pins[i:i + CHUNK]
        quoted = ",".join("'" + p.replace("'", "''") + "'" for p in chunk)
        q = urllib.parse.urlencode({
            "$where": f"{pin_field} in ({quoted})",
            "$limit": str(CHUNK * 2),
        })
        rows = http_json(base + "?" + q)
        for row in rows:
            pin = str(row.get(pin_field, "")).strip()
            if pin:
                result[pin] = row
        print(f"  {min(i + CHUNK, len(pins))}/{len(pins)} PINs queried, "
              f"{len(result)} matched", file=sys.stderr)
    return result


# ------------------------------------------------------------------ main ----

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--url", help="ArcGIS FeatureServer/MapServer layer URL "
                                   "(ends in /FeatureServer/0 or similar)")
    src.add_argument("--socrata", help="Socrata resource URL "
                                       "(https://data.../resource/XXXX-XXXX.json)")
    ap.add_argument("--pin-field", help="attribute field holding the parcel PIN")
    ap.add_argument("--fields", default="*",
                    help="comma-separated fields to fetch (default: all)")
    ap.add_argument("--list-fields", action="store_true",
                    help="print the ArcGIS layer's field names and exit")
    ap.add_argument("--data-js", default=DATA_JS,
                    help=f"path to the screener's data.js (default: {DATA_JS})")
    ap.add_argument("--out", default="county_enrich.json", help="output file")
    args = ap.parse_args()

    if args.list_fields:
        if not args.url:
            ap.error("--list-fields requires --url")
        fields, name = arcgis_fields(args.url)
        print(f"Layer: {name}")
        for f in fields:
            print(f"  {f.get('name'):<32} {f.get('type', '')}  {f.get('alias', '')}")
        return

    if not args.pin_field:
        ap.error("--pin-field is required for fetching (use --list-fields to discover it)")

    pins = read_pins(args.data_js)
    print(f"{len(pins)} unique PINs read from {args.data_js}", file=sys.stderr)

    if args.url:
        matched = fetch_arcgis(args.url, pins, args.pin_field, args.fields)
    else:
        matched = fetch_socrata(args.socrata, pins, args.pin_field)

    unmatched = [p for p in pins if p not in matched]
    out = {"_source": args.url or args.socrata,
           "_pin_field": args.pin_field,
           "_matched": len(matched),
           "_unmatched": unmatched,
           "parcels": matched}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(f"wrote {args.out}: {len(matched)} matched, {len(unmatched)} unmatched")
    if unmatched[:5]:
        print("  first unmatched PINs:", ", ".join(unmatched[:5]))
        print("  (PIN formatting often differs — try stripping spaces/dashes, "
              "or check the field with --list-fields)")


if __name__ == "__main__":
    main()
