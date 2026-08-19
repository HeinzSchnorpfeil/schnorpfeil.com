#!/usr/bin/env python3
"""Prüft die in Impressum und Datenschutzerklärung verlinkten Ziele.

Hintergrund: Die EU-Plattform zur Online-Streitbeilegung wurde am 20.07.2025
abgeschaltet. Der Link im Impressum lief danach monatelang ins Leere, ohne dass
es jemandem auffiel. Genau das fängt dieser Lauf ab — eine Umleitung auf eine
andere Seite ist dabei das wichtigere Signal als ein glatter 404.

Exit 1 bei 4xx/5xx oder Verbindungsfehler; Umleitungen werden gemeldet.
"""
import json
import re
import sys
import urllib.error
import urllib.request

LOCALES = ["de", "en", "pl", "ru"]
KEYS = ["legal_impressum_content", "legal_privacy_content"]
URL_RE = re.compile(r'href="(https?://[^"]+)"')
UA = "schnorpfeil-legal-linkcheck/1.0 (+https://schnorpfeil.com)"
TIMEOUT = 25


def collect():
    """URL -> sortierte Liste der Fundstellen."""
    found = {}
    for lang in LOCALES:
        with open(f"src/locales/{lang}.json", encoding="utf-8") as f:
            data = json.load(f)
        for key in KEYS:
            for url in URL_RE.findall(data.get(key, "")):
                found.setdefault(url, set()).add(f"{lang}/{key.split('_')[1]}")
    return {u: sorted(v) for u, v in sorted(found.items())}


def check(url):
    """(status, final_url, error) — GET, weil manche Hosts HEAD ablehnen."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, r.geturl(), None
    except urllib.error.HTTPError as e:
        return e.code, e.geturl(), None
    except Exception as e:  # DNS, TLS, Timeout
        return None, None, f"{type(e).__name__}: {e}"


def main():
    urls = collect()
    if not urls:
        print("Keine externen Links in den Rechtstexten gefunden.")
        return 0

    failed, redirected = [], []
    for url, where in urls.items():
        status, final, err = check(url)
        tag = ", ".join(where)
        if err:
            print(f"FEHLER  {url}  ({tag})  {err}")
            failed.append(url)
        elif status >= 400:
            print(f"FEHLER  {url}  ({tag})  HTTP {status}")
            failed.append(url)
        elif final and final.rstrip("/") != url.rstrip("/"):
            print(f"UMLEIT  {url}  ({tag})  HTTP {status} -> {final}")
            redirected.append((url, final))
        else:
            print(f"ok      {url}  ({tag})  HTTP {status}")

    print()
    if redirected:
        print("Umgeleitete Links bitte ansehen — eine Umleitung auf eine andere Seite")
        print("kann bedeuten, dass das Angebot dahinter eingestellt wurde:")
        for url, final in redirected:
            print(f"  {url}\n    -> {final}")
        print()
    if failed:
        print(f"{len(failed)} Link(s) nicht erreichbar.", file=sys.stderr)
        return 1
    print("Alle Links erreichbar.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
