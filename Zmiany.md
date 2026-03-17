## Daily Command Center
- 2026-03-16 – Zakres dat i konfiguracja sekcji
  -- W pierwszej linii filtrów dodano kompaktowe pola wyboru dat z przyciskiem resetu (ikona), a sekcja "Aktywności" jest zawsze prezentowana w zadanym zakresie.
  -- W konfiguracji sekcji dodano przełącznik "Uwzględniaj daty" (domyślnie wyłączony); kolumny z aktywną opcją filtrują zadania po dacie, a zgłoszenia widoczne w "Aktywnościach" pozostają tam rozwinięte (z ręcznym zwijaniem) i automatycznie pokazują się jako zwinięte/przyciemnione w pozostałych kolumnach.

## Raport CBCP
- 2026-03-17 – Poprawa polskich znaków w eksporcie
  -- Poprawiono uszkodzone literały tekstowe w eksporcie raportu CBCP do plików Word i Excel.
  -- Wygenerowane raporty Word i Excel pokazują poprawne polskie znaki w nagłówkach, opisach oraz komunikacie o braku zleceń.

## Repozytorium i bezpieczeństwo
- 2026-03-17 – Wykluczenie sekretów i lokalnej bazy z Git
  -- Uporządkowano plik `.gitignore` i dodano wykluczenia dla `.env`, `.google-tokens.json` oraz plików SQLite (`baza_danych.db`, `-shm`, `-wal`).
  -- Sekrety i lokalne pliki danych pozostają dostępne wyłącznie lokalnie, a kolejne commity nie powinny już blokować push przez GitHub Push Protection.
