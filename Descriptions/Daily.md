WIZJA PRODUKTU: Panel DAILY (Stand-up Command Center)
[DIAGNOZA PROBLEMÓW]
Brak widoków międzyprojektowych (Cross-Project): PM często prowadzi spotkania Daily dla zespołów, które pracują nad kilkoma projektami jednocześnie. YouTrack wymusza przełączanie się między osobnymi tablicami (Agile Boards), co spowalnia spotkanie.
Problemy z zakresem dat po weekendzie: Standardowe filtry "ostatnie 24 godziny" nie sprawdzają się w poniedziałki, wymagając od PM-a ręcznego klikania w kalendarzu i szukania piątku.
Zanieczyszczanie YouTracka notatkami roboczymi: Podczas Daily padają luźne ustalenia, które PM musi gdzieś zapisać. Dodawanie ich jako oficjalnych komentarzy w YouTracku często tworzy szum informacyjny. PM potrzebuje lokalnego brudnopisu per zadanie.
Sztywna struktura statusów: Każdy projekt w YouTracku może mieć nieco inny workflow. Brak możliwości łatwego mapowania i grupowania wielu statusów w jedną spójną kolumnę (np. "Na testach" dla statusów: To Verify, Testing, QA) utrudnia szybki przegląd.
[STRATEGIA INTEGRACJI Z YOUTRACK]
Architektura w dalszym ciągu traktuje YouTrack jako system Read-Only, a wszystkie konfiguracje widoków oraz komentarze żyją w lokalnej bazie SQLite.
Lokalna Konfiguracja (SQLite): Baza przechowuje definicje kafelków (nazwa, opis, skróty projektów np. PROJA, PROJB), układ i kolejność sekcji zadań oraz zmapowane do nich statusy.
Budowanie Zapytań (Query Builder): Aplikacja React na podstawie konfiguracji kafelka dynamicznie buduje zapytanie REST API do YouTracka. Przykład dla kafelka ze skrótami PROJ1, PROJ2: project: PROJ1, PROJ2 updated: [data_od] .. [data_do].
Przetwarzanie w aplikacji: Pobrane z API zadania (Issues) są parsowane w pamięci i przypisywane do odpowiednich sekcji na podstawie ich pola State, dopasowując je do lokalnie zdefiniowanych grup.
Lokalne Komentarze: Notatki wpisywane w zadaniach zapisywane są w tabeli SQLite powiązanej relacją z IssueID z YouTracka.
[KLUCZOWE MODUŁY I FUNKCJE]
1. Menedżer Kafelków (Poziom 1 - Hub)
Lokalizacja w Sidebarze: Skrót do modułu "Daily" znajduje się na samym dole paska bocznego, wyraźnie odseparowany od globalnego selektora pojedynczych projektów. Gwarantuje to, że wejście w Daily nie nadpisuje globalnego kontekstu pracy aplikacji.
Katalog Kafelków: Ekran startowy prezentujący zdefiniowane spotkania (np. "Daily Mobile Team", "Daily Backend").
Konfigurator: Edytor kafelka pozwalający ustawić nazwę, krótki opis oraz pole tekstowe na wpisanie skrótów projektów z YouTracka, oddzielonych przecinkami.
2. Dynamiczny Panel Zadań (Poziom 2 - Tablica)
Konfigurowalne Sekcje: Zadania wyświetlają się w sekcjach (domyślnie: Aktywności, Zaplanowane, W trakcie, Testy, Zakończone). PM może wejść w tryb edycji tablicy, aby dodać nową sekcję (np. "Zablokowane") i przypisać do niej statusy z YouTracka po przecinku (np. Blocked, Waiting for reply).
Drag & Drop: Mechanizm chwytania i upuszczania (np. za pomocą biblioteki dnd-kit lub react-beautiful-dnd), pozwalający na dowolne przesuwanie sekcji w górę i w dół ekranu w zależności od preferencji zespołu. Układ musi być zapamietywany w ramach daily.
Płaskie Listy: Zadania wewnątrz sekcji wyświetlane są w formie kompaktowych wierszy lub małych kart, eksponując kluczowe dane: ID, Tytuł, Przypisaną osobę i projekt.
3. Inteligentny Silnik Filtrowania
Smart Date Range: Automatyczne ustawianie filtru dat na "Od wczoraj do dzisiaj". Wdrożenie logiki wykrywającej dni tygodnia: jeśli systemowy czas wskazuje na poniedziałek, silnik domyślnie ustawia zakres "Od piątku do poniedziałku". Możliwość ręcznego nadpisania dat w kalendarzu.
Szybkie Filtry (Pills): Górna belka generuje interaktywne "pigułki" (przyciski) na podstawie danych pobranych w danym widoku:
Projekty: Przyciski z nazwami projektów występujących w danym Daily.
Osoby: Avatary/imiona i nazwiska osób, które mają przypisane zadania.
Kliknięcie filtruje widok natychmiast (Client-side filtering, bez ponownego pingu do API). Możliwe jest zaznaczenie kilku projektów/osób naraz. Obecny jest zawsze przycisk zraszający "Wszystkie".
Filtr "Skomentowane": Przycisk pokazujący wyłącznie te zadania, w których PM dodał lokalny komentarz w filtrowanym okresie.
4. Lokalny Moduł Komentarzy (Brudnopis PM-a)
Inline Input: Rozwijane pod zadaniem pole tekstowe umożliwiające szybkie zrobienie notatki podczas wypowiedzi członka zespołu.
Lokalny Zapis: Po kliknięciu "Zapisz" (lub wciśnięciu Enter), komentarz trafia do bazy SQLite powiązany z IssueID. Komentarz jest widoczny tylko dla PM-a w tej aplikacji.
[PRZYKŁAD ZASTOSOWANIA] (User Flow)
Kontekst: Jest poniedziałek, godzina 9:00. PM prowadzi spotkanie dla zespołu tworzącego aplikację, która obejmuje prace w systemach iOS, Android oraz API. W YouTracku są to 3 osobne projekty (skróty: IOS, AND, API).
Przygotowanie: PM otwiera aplikację i klika ikonę "Daily" na dole paska bocznego. Wybiera stworzony wcześniej kafelek o nazwie "Mobile Sync", który pod maską ma wpisane projekty: IOS, AND, API.
Automatyzacja Dat: Aplikacja automatycznie wykrywa poniedziałek i ładuje z API YouTracka zadania zmienione i zaktualizowane w okresie od minionego piątku. Zadania mają linki z YouTracka aby je łatwo otwierać w przeglądarce.
Konfiguracja w locie: Zespół zgłasza, że dużo zadań utknęło przez braki dostępów. PM wchodzi w edycję układu, klika "Dodaj sekcję", nazywa ją "Zablokowane", wpisuje status Blocked i przeciąga ją myszką na samą górę ekranu. Aplikacja natychmiast grupuje zablokowane zadania na górze.
Filtrowanie: Kolej na raportowanie przez programistę "Jana Kowalskiego". PM klika jego imię na górnej belce w filtrach (Pills). Cały widok natychmiast ukrywa resztę zespołu, zostawiając zadania Janka w widoku piątek-poniedziałek.
Notowanie ustaleń: Jan mówi, że zadanie API-404 zajmie mu więcej czasu z powodu błędów środowiska. PM klika w zadanie API-404 i wpisuje lokalny komentarz: "Janek zgłasza problemy ze stagingiem, sprawdzić po daily z DevOpsami". Zapisuje w lokalnej bazie.
Follow-up: Po zakończeniu spotkania PM klika górny filtr "Skomentowane" i resetuje filtr osób do "Wszystkie". Na ekranie zostają mu tylko zadania, w których podczas spotkania zrobił notatki. W ten sposób błyskawicznie widzi swoją "To-Do listę" (akcje po spotkaniu).