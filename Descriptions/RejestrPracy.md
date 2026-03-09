WIZJA PRODUKTU: PANEL REJESTR PRACY (Architektura Local-First)
[DIAGNOZA PROBLEMÓW]
Ryzyko przeciążenia API (Throttling): Masowe zapytania o wieloletnie dane historyczne mogą zablokować dostęp do API YouTracka. Konieczne jest kontrolowane, wsadowe kolejkowanie zapytań
.
Narzut pracy przy kategoryzacji: Ręczne przypisywanie każdego zadania do grupy od zera jest nieefektywne. Zdecydowana większość pracy w projektach IT to realne programowanie, co powinno stanowić zautomatyzowany punkt wyjścia.
Konieczność zachowania aktualności danych: Praca nad projektem jest płynna, wpisy czasu ulegają modyfikacjom (np. korekty logów czasu przez zespół), co wymaga wdrożenia mechanizmu ponownej synchronizacji na żądanie, z zachowaniem wcześniej nadanych kategorii.
Brak elastycznej re-kategoryzacji: Zespół często zmienia charakter pracy w ramach jednego zadania. PM potrzebuje narzędzia do szybkiej korekty przypisanych grup w zależności od bieżącej analizy, bez ingerowania w backend YouTracka.
[STRATEGIA INTEGRACJI Z YOUTRACK]
Architektura opiera się na podejściu Local-First
 z mechanizmem synchronizacji na żądanie (Pull) w ujęciu wsadowym. YouTrack traktowany jest wyłącznie jako źródło prawdy do odczytu (Read-Only).
Pobieranie IssueTimeTracking i IssueWorkItem: Aplikacja dzieli żądany zakres dat na paczki miesięczne i odpytuje endpointy API sekwencyjnie
. Zabezpiecza to infrastrukturę przed limitem zapytań (rate limiting).
Zapis i Domyślna Kategoryzacja: Aplikacja zapisuje nowe oraz zmodyfikowane obiekty WorkItem w lokalnej, szyfrowanej bazie danych (SQLite)
. Każde nowe zadanie, dla którego pobrano logi czasu, automatycznie otrzymuje w lokalnej bazie flagę: Programistyczne.
Aktualizacja Danych (Smart Upsert): Synchronizacja dociąga nowe przepracowane godziny (Actual Time) do lokalnego licznika
. System weryfikuje różnice, ale bezwzględnie zachowuje manualne zmiany kategorii (np. zmianę na "Obsługa projektu") dokonane wcześniej przez PM-a w lokalnej bazie.
[KLUCZOWE MODUŁY I FUNKCJE]
1. Silnik Synchronizacji i Bazy Danych (Backend lokalny)
Miesięczne paczkowanie (Monthly Chunking): Mechanizm analizuje zakres dat żądany przez PM-a (np. ostatnie 2 lata), dzieli go na 24 interwały miesięczne i wysyła asynchroniczne zapytania z kontrolowanym opóźnieniem.
Mechanizm Delta-Sync: Śledzenie pola lastModifiedDateTime wpisów czasu, dzięki czemu kolejne aktualizacje pobierają tylko przyrost
.
Lokalny magazyn relacyjny: Baza SQLite przechowująca relację 1:1 między IssueID a lokalną grupą rozliczeniową.
2. Zakładka: "YouTrack" (Zarządzanie, Edycja i Kategoryzacja) Służy jako stół roboczy dla PM-a do transformacji surowych danych pobranych z API.
Domyślna Klasyfikacja: Eliminacja mikro-zarządzania; 80-90% standardowych zadań programistycznych nie wymaga jakiejkolwiek akcji ze strony użytkownika, by trafić do właściwej grupy w statystykach.
Inline Editing (Szybka edycja): Tabela wyświetlająca zadania z możliwością natychmiastowej zmiany przypisanej wartości w kolumnie "Grupa" za pomocą rozwijanej listy (Opcje: Programistyczne, Obsługa projektu, Inne).
Filtrowanie i Inspekcja (Offline): Błyskawiczne wyszukiwanie po nazwie zgłoszenia, osobie lub przypisanej grupie bazujące w 100% na danych lokalnych. Umożliwia masową weryfikację i przeklikiwanie specyficznych typów zadań (np. ticketów wsparcia technicznego).
3. Zakładka: "Statystyka" (Raportowanie i Analiza) Prezentuje przetworzone dane, umożliwiając natychmiastowe analizy odchyleń i wydajności
.
Czas Rzeczywisty (Zero Latency): Wykresy renderują się natychmiastowo, czytając zoptymalizowany stan z bazy SQLite, z pominięciem opóźnień sieciowych API
.
Wielowymiarowe Macierze Czasowe: Widoki zagregowanych przepracowanych godzin nałożone na oś lat i miesięcy z uwzględnieniem wybranej kategoryzacji (Programistyczne vs Obsługa vs Inne).
Drill-down Zasobów: Interaktywna struktura pozwalająca zejść od poziomu portfela projektu, przez konkretny miesiąc, aż do pojedynczego pracownika i wyciągu jego zaraportowanych zadań (Work Items).
[PRZYKŁAD ZASTOSOWANIA] (User Flow)
Problem biznesowy: PM musi podsumować i rozliczyć 12 miesięcy trwania projektu, upewniając się, że nowe zadania zostały poprawnie sklasyfikowane, a klient otrzyma precyzyjne dane finansowe (podział na rozwój oprogramowania i obsługę).
Aktualizacja danych: PM otwiera aplikację i w zakładce "Rejestr Pracy" klika "Aktualizuj". Aplikacja pod maską dzieli 12 miesięcy na 12 paczek i płynnie dociąga z YouTracka tysiące nowych oraz zmodyfikowanych logów czasu, nie blokując wątku sieciowego.
Domyślne procesowanie: Setki nowych zadań, w których zespół logował czas przez ostatni okres, automatycznie trafia w lokalnej bazie do grupy "Programistyczne".
Edycja w zakładce "YouTrack": PM wyszukuje w tabeli specyficzne zadania używając słów kluczowych "Deployment" oraz "Daily Scrum". Korzystając z opcji szybkiej edycji, koryguje ich status na "Obsługa projektu".
Analiza w zakładce "Statystyka": PM przechodzi do widoku raportów. Aplikacja natychmiast renderuje wykresy za cały rok. Wyraźnie widać miesięczny rozkład utylizacji godzin ze zmodyfikowanym, poprawnym udziałem prac programistycznych w stosunku do kosztów obsługi.
Trwałość architektury (Smart Merge): Podczas kolejnej aktualizacji za dwa tygodnie, nowo przepracowane godziny w zadaniu "Deployment" są dociągane z API, jednak zadanie pozostaje bezpiecznie w grupie "Obsługa projektu" – system respektuje nadpisane wcześniej decyzje PM-a.
Jakie tabele SQLite zaproponować dla synchronizacji miesięcznej?
Jak zabezpieczyć lokalną bazę danych przed nieautoryzowanym dostępem?
Jakie biblioteki JavaScript najlepiej obsłużą kategoryzację zadań?