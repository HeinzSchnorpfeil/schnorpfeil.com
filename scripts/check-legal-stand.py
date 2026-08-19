#!/usr/bin/env python3
"""Verhindert, dass die Datenschutzerklärung geändert wird, ohne den "Stand" mitzuziehen.

Das Datum ist eine Aussage darüber, wann zuletzt geprüft wurde. Es automatisch
hochzuzählen würde es wertlos machen — also wird hier stattdessen erzwungen,
dass es bei inhaltlichen Änderungen von Hand angefasst wird.

Aufruf: check-legal-stand.py <base-rev> [<head-rev>]
"""
import datetime
import json
import re
import subprocess
import sys

LOCALES = ["de", "en", "pl", "ru"]
KEY = "legal_privacy_content"
# "Stand: …", "Last updated: …", "Stan na: …", "По состоянию на: …"
DATE_RE = re.compile(r"(?:Stand|Stan na|Last updated|По состоянию на):\s*([^<]+)")

MONTHS = {
    # de
    "januar": 1, "februar": 2, "märz": 3, "april": 4, "mai": 5, "juni": 6,
    "juli": 7, "august": 8, "september": 9, "oktober": 10, "november": 11, "dezember": 12,
    # en
    "january": 1, "february": 2, "march": 3, "may": 5, "june": 6, "july": 7,
    "october": 10, "december": 12,
    # pl (Genitiv)
    "stycznia": 1, "lutego": 2, "marca": 3, "kwietnia": 4, "maja": 5, "czerwca": 6,
    "lipca": 7, "sierpnia": 8, "września": 9, "października": 10, "listopada": 11, "grudnia": 12,
    # ru (Genitiv)
    "января": 1, "февраля": 2, "марта": 3, "апреля": 4, "мая": 5, "июня": 6,
    "июля": 7, "августа": 8, "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12,
}
# Toleranz: ein Stand, der jünger ist als das, gilt als "frisch genug" — deckt
# mehrere Änderungen am selben Tag und kurzlebige Pull Requests ab.
FRESH_DAYS = 30
PARTS_RE = re.compile(r"(\d{1,2})\.?\s+(\S+?)\s+(\d{4})")


def parse_date(text):
    """Stand-Datum als date, oder None wenn nicht lesbar."""
    m = PARTS_RE.search(text or "")
    if not m:
        return None
    day, month_word, year = m.group(1), m.group(2).strip(".,").lower(), m.group(3)
    month = MONTHS.get(month_word)
    if month is None:
        return None
    try:
        return datetime.date(int(year), month, int(day))
    except ValueError:
        return None



def load(rev, path):
    """Locale-Datei bei einer Revision lesen; None, wenn dort nicht vorhanden."""
    r = subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True)
    if r.returncode != 0:
        return None
    return json.loads(r.stdout.decode("utf-8"))


def date_of(text):
    m = DATE_RE.search(text)
    return m.group(1).strip() if m else None


def body_of(text):
    """Inhalt ohne das Datum — damit eine reine Datumsänderung nicht als Inhalt zählt."""
    return DATE_RE.sub("", text)


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: check-legal-stand.py <base-rev> [<head-rev>]")
    base = sys.argv[1]
    head = sys.argv[2] if len(sys.argv) > 2 else "HEAD"

    if not base or set(base) <= {"0"}:
        print("Kein Basis-Commit (neuer Branch) — Prüfung übersprungen.")
        return 0

    problems = []
    for lang in LOCALES:
        path = f"src/locales/{lang}.json"
        old, new = load(base, path), load(head, path)
        if new is None:
            problems.append(f"{path}: fehlt in {head}")
            continue

        new_text = new.get(KEY, "")
        new_date = date_of(new_text)
        if new_date is None:
            problems.append(f"{path}: kein Stand-Datum in {KEY} gefunden")
            continue

        if old is None:
            continue  # neue Datei, nichts zu vergleichen

        old_text = old.get(KEY, "")
        if body_of(old_text) == body_of(new_text):
            continue  # inhaltlich unverändert

        # Inhalt hat sich geändert. Entscheidend ist nicht, OB das Datum
        # angefasst wurde, sondern dass das Ergebnis aktuell ist — sonst käme
        # ein Zurückdatieren durch.
        parsed = parse_date(new_date)
        if parsed is None:
            problems.append(
                f'{path}: Stand "{new_date}" ist nicht lesbar. Erwartet wird '
                f'"<Tag> <Monat> <Jahr>", z. B. "19. August 2026".'
            )
            continue

        age = (datetime.date.today() - parsed).days
        if age < 0:
            problems.append(f'{path}: Stand "{new_date}" liegt in der Zukunft.')
        elif age > FRESH_DAYS:
            problems.append(
                f"{path}: {KEY} wurde geändert, aber der Stand steht auf "
                f'"{new_date}" ({age} Tage alt). Bitte auf den Tag der Prüfung setzen.'
            )
        else:
            print(f'{lang}: Inhalt geändert, Stand "{new_date}" ({age} Tage alt) — ok')

    if problems:
        print("\nStand-Prüfung fehlgeschlagen:\n", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        print(
            "\nDas Datum wird bewusst nicht automatisch gesetzt: es soll aussagen, "
            "wann zuletzt jemand hingesehen hat.",
            file=sys.stderr,
        )
        return 1

    print("Stand-Prüfung ok.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
