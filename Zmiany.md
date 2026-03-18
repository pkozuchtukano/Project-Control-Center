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
- 2026-03-18 – Dodanie raportu PMS
  -- W rejestrze zleceń dodano osobny raport `PMS` z tym samym zestawem filtrów i akcji eksportu co raport `CBCP`, dostępny z nowego przycisku w nagłówku widoku.
  -- Raport `PMS` rozbija zlecenie na wiersze `Produkty zlecenia`, scala pionowo komórki wspólne dla jednego zlecenia, pokazuje godziny i kwoty per produkt oraz sumy łączne w podglądzie wydruku, eksporcie Excel i eksporcie Word.

## Rozliczenia
- 2026-03-18 – Nowoczesne zestawienie rozliczeń umowy
  -- W zakładce `Rozliczenia` zastąpiono placeholder rzeczywistym widokiem analitycznym z kartami, tabelą i blokiem podsumowania opartymi na danych projektu oraz zleceń.
  -- Widok pokazuje automatycznie liczone wartości: `Umowa max godzin`, `Zakontraktowane`, `Rozliczone`, `Do rozliczenia` oraz `Pozostało w umowie`, a także rozbicie zleceń bez PO na `W trakcie` i `Oddane PP`.
- 2026-03-18 – Kwoty i zyskowność w rozliczeniach
  -- Rozszerzono zakładkę `Rozliczenia` o zestawienie wartości netto i brutto dla wszystkich kluczowych pozycji godzinowych oraz tabelę łączącą godziny z kwotami.
  -- Dodano sekcję `Zyskowność projektu`, która pokazuje zakontraktowane godziny, rzeczywiście przepracowane godziny z YouTrack oraz zysk liczony jako różnica tych godzin, zarówno ilościowo, jak i wartościowo.
- 2026-03-18 – Zestawienie osób w rozliczeniach
  -- Do zakładki `Rozliczenia` dodano listę osób pracujących w projekcie z sumą ich zalogowanych roboczogodzin na podstawie danych z rejestru pracy YouTrack.
  -- Każda osoba pokazuje łączną liczbę godzin oraz udział procentowy w całkowitej puli godzin przepracowanych w projekcie.
- 2026-03-18 – Uporządkowanie układu rozliczeń
  -- Kafelek `Wykorzystanie umowy` pokazuje teraz dodatkowo bezpośrednio liczbę godzin pozostałych lub przekroczonych względem limitu umowy.
  -- Sekcję `Tabela rozliczeń` przebudowano z szerokiej tabeli na bardziej kompaktowe karty pozycji z wydzielonymi kwotami netto i brutto, aby widok nie rozciągał się nadmiernie w poziomie.
- 2026-03-18 – Raport zarządczy PDF dla rozliczeń
  -- Do zakładki `Rozliczenia` dodano osobny przycisk `Raport zarządczy PDF`, który otwiera widok przygotowany do eksportu `PDF / Drukuj`.
  -- Raport pokazuje karty KPI, wykresy godzinowe i wartościowe, rozkład zleceń według statusu formalnego, strukturę pracy z YouTrack, zestawienie osób z zalogowanymi godzinami oraz automatyczne komentarze opisujące bieżący stan projektu.
- 2026-03-18 – Maskowanie kwot w rozliczeniach
  -- Wszystkie kwoty w zakładce `Rozliczenia` i w raporcie zarządczym PDF są domyślnie ukryte, aby ograniczyć przypadkowe ujawnienie danych finansowych.
  -- Dodano przełącznik z ikoną dolara, który odsłania albo ponownie chowa całe linie finansowe `Netto` i `Brutto` oraz wykres finansowy, zamiast maskować same liczby.
  -- Poprawiono źródło danych finansowych w zestawieniach, aby kwoty były przechowywane jako wartości liczbowe do momentu renderowania i nie wyświetlały `NaN` po odsłonięciu.
- 2026-03-18 – Pionowy układ raportu zarządczego PDF
  -- Raport zarządczy PDF przebudowano z układu poziomego na pionowy `A4 portrait`, aby strony łamały się przewidywalnie przy wydruku.
  -- Zawartość rozdzielono na osobne strony: podsumowanie i KPI, analitykę godzin oraz osobną stronę operacyjną dla zespołu, dzięki czemu druga i kolejne strony nie są gubione przy generowaniu PDF.
  -- Uporządkowano nagłówek strony analitycznej raportu: statusy zleceń przeniesiono pod opis sekcji i pokazano jako większe, czytelniejsze karty zamiast wąskich kafelków ustawionych obok tekstu.
  -- Dopasowano typografię i siatkę kart statusów tak, aby dłuższe etykiety i opisy zawijały się wewnątrz kafelków i nie wychodziły poza ich obrys.
  -- Poprawiono także padding i proporcje kart z metadanymi projektu w nagłówku raportu, aby dłuższe wartości mieściły się estetycznie i nie wyglądały na ściśnięte.
  -- Poprawiono mechanikę wydruku raportu: przy druku warstwa raportu przestaje działać jako przewijany overlay `fixed`, a sekcje nie wymuszają już zamknięcia na pojedynczej stronie, dzięki czemu PDF może generować tyle stron, ile wymaga pełna zawartość.
- 2026-03-18 – Bezpośredni zapis raportu zarządczego do pliku PDF
  -- Zastąpiono przycisk `Export PDF / Drukuj` w raporcie zarządczym natywnym eksportem Electron `printToPDF`, który zapisuje dokument bez otwierania systemowego okna drukowania.
  -- Aplikacja pokazuje teraz okno zapisu pliku `.pdf`, generuje dokument w formacie `A4 portrait` z użyciem istniejących styli wydruku i zapisuje gotowy plik na dysku.
- 2026-03-18 – Korekta statusów zleceń w rozliczeniach
  -- Zmieniono logikę liczenia statusów zleceń: brak wszystkich dat oznacza `Anulowane`, a `Do rozliczenia` obejmuje tylko zlecenia z uzupełnioną datą realizacji `od`, ale bez daty odbioru.
  -- Tę samą regułę zastosowano w zakładce `Rozliczenia` oraz w raporcie zarządczym PDF, aby liczniki, godziny i statusy były spójne w całej aplikacji.
  -- Status `Anulowane` nie jest pokazywany jako osobny główny kafelek KPI; pozostaje jedynie jako element logiki i w sekcji statusów zleceń.

## Rejestr pracy
- 2026-03-18 – Stabilizacja statystyk i wykresów
  -- Przepisano komponent statystyk rejestru pracy, aby tooltipy Recharts renderowały wyłącznie tekstowe etykiety zamiast obiektów oraz aby wykres kołowy jawnie używał pola `name` jako etykiety segmentu.
  -- Dodano zabezpieczenia dla pustych zakresów dat i kontenerów wykresów (`min-w-0`, minimalne wysokości, warunkowe renderowanie wykresów), dzięki czemu widok nie wywołuje błędu Reacta o renderowaniu obiektu ani ostrzeżeń Recharts o szerokości/wysokości `-1`.
- 2026-03-18 – Normalizacja etykiet typu i statusu z YouTrack
  -- W `YouTrackTab` dodano odczyt etykiet `name` z obiektów statusu i typu zadania zwracanych przez YouTrack, zamiast bezpośredniego renderowania całych obiektów.
  -- Karty zadań renderują teraz poprawne nazwy statusów i typów, co eliminuje błąd Reacta `Objects are not valid as a React child`.
