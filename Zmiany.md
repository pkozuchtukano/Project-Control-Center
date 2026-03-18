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

## Synchronizacja bazy danych
- 2026-03-18 – Ręczny eksport i import bazy danych
  -- Dodano przyciski eksportu i importu lokalnej bazy SQLite w lewym dolnym rogu sidebara oraz IPC w procesie Electron do tworzenia spójnego snapshotu i podmiany pliku bazy.
  -- Użytkownik może zapisać kopię bazy do pliku `.db` lub zaimportować wskazaną kopię i odświeżyć aplikację na danych z importu.
- 2026-03-18 – Synchronizacja bazy z Google Drive przy starcie i zamykaniu
  -- Dodano obsługę współdzielonego folderu Google Drive wskazywanego przez `GOOGLE_DRIVE_SHARED_FOLDER_LINK` w `.env`, wraz z eksportem bazy przy zamykaniu aplikacji i sprawdzaniem nowszej kopii przy starcie.
  -- Przy zamykaniu aplikacja pyta o eksport bazy do Google Drive, a przy uruchomieniu porównuje datę lokalnej i zdalnej kopii oraz proponuje pobranie nowszej bazy z folderu współdzielonego.
- 2026-03-18 – Przełączenie ręcznego eksportu i importu bazy na Google Drive
  -- Zmieniono ręczne przyciski `Eksport bazy` i `Import bazy`, aby nie używały już lokalnych okien wyboru pliku, tylko bezpośrednio zapisywały i pobierały bazę z udostępnionego folderu Google Drive.
  -- Dodatkowo obsłużono błąd brakujących scope tokenu Google i aplikacja pokazuje teraz jasny komunikat o konieczności ponownego wylogowania i autoryzacji po dodaniu uprawnień Drive.

## Rejestr zleceń
- 2026-03-18 – Zapamiętywanie pozycji w tabeli wyceny kolejnego zlecenia
  -- Formularz zlecenia zapisuje per projekt w bazie SQLite nazwy pozycji z tabeli `Wycena (Produkty zlecenia)` oraz ostatnią używaną datę wykonania.
  -- Przy tworzeniu kolejnego zlecenia nazwy pozycji są podstawiane automatycznie z bazy, godziny startują od `0`, a data wykonania jest ustawiana na ostatnią zapamiętaną datę z poprzedniego zestawienia.
- 2026-03-18 – Dwa miejsca po przecinku dla roboczogodzin
  -- Pole `L. godzin rob.` w formularzu zlecenia przyjmuje teraz wartości z krokiem `0.01`, a podsumowania godzin w formularzu i na liście zleceń są formatowane do dwóch miejsc po przecinku.
  -- Rejestr zleceń oraz widok/eksport raportu CBCP zachowują precyzję `0,00 h`, dzięki czemu częściowe roboczogodziny nie są już zaokrąglane w prezentacji.

## Rejestr pracy
- 2026-03-18 – Stabilizacja statystyk i wykresów
  -- Przepisano komponent statystyk rejestru pracy, aby tooltipy Recharts renderowały wyłącznie tekstowe etykiety zamiast obiektów oraz aby wykres kołowy jawnie używał pola `name` jako etykiety segmentu.
  -- Dodano zabezpieczenia dla pustych zakresów dat i kontenerów wykresów (`min-w-0`, minimalne wysokości, warunkowe renderowanie wykresów), dzięki czemu widok nie wywołuje błędu Reacta o renderowaniu obiektu ani ostrzeżeń Recharts o szerokości/wysokości `-1`.
- 2026-03-18 – Normalizacja etykiet typu i statusu z YouTrack
  -- W `YouTrackTab` dodano odczyt etykiet `name` z obiektów statusu i typu zadania zwracanych przez YouTrack, zamiast bezpośredniego renderowania całych obiektów.
  -- Karty zadań renderują teraz poprawne nazwy statusów i typów, co eliminuje błąd Reacta `Objects are not valid as a React child`.
