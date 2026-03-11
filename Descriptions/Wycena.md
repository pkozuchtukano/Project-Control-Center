WIZJA PRODUKTU: ZAKŁADKA "WYCENA" (Smart Estimation)
[DIAGNOZA PROBLEMÓW]
Brak elastyczności szablonów: Wyceny różnią się w zależności od projektu i klienta. Sztywne formularze zmuszają PM-a do ręcznego dopisywania lub usuwania wierszy przy każdej nowej ofercie.
Narzut pracy przy kalkulacji buforów (ryzyk): Ręczne przeliczanie surowych estymacji zespołu przez współczynniki ryzyka/narzutu jest podatne na błędy i utrudnia śledzenie pierwotnych założeń.
Problemy z formatowaniem przy eksporcie: Kopiowanie danych z aplikacji webowych/desktopowych do ustrukturyzowanych tabel w MS Word często niszczy formatowanie dokumentu docelowego.
Niespójność harmonogramów: Harmonogramy ofertowe przybierają różne formy (od prostych dat granicznych po szczegółowe kroki milowe), co wymaga obsługi wielu wariantów w ramach jednego narzędzia.
[STRATEGIA DANYCH I ARCHITEKTURA LOCAL-FIRST]
Moduł opiera się na lokalnej, szyfrowanej bazie SQLite (wykorzystującej np. rozszerzenie better-sqlite3-multiple-ciphers
). Dzięki przechowywaniu stawek, współczynników i szablonów lokalnie, PM może przeprowadzać bezpieczne symulacje "co-jeśli" bez wpływu na dane w systemach produkcyjnych (YouTrack)
.
Pamięć Kontekstu Projektu: Baza danych zapisuje ostatnio użyty układ wierszy (Zadania/Pozycje wyceny) oraz format harmonogramu dla danego ProjectID. Przy tworzeniu nowej wyceny, system ładuje domyślny układ zapisany dla tego konkretnego projektu.
Zarządzanie Stawkami: Globalna stawka godzinowa przypisana do projektu jest pobierana jako wartość domyślna, ale każda pozycja w kalkulacji posiada własne, edytowalne pole stawki.
Smart Clipboard API: Zamiast pełnego eksportu plików, aplikacja wykorzystuje natywne API schowka Electrona do wstrzykiwania precyzyjnie sformatowanego kodu HTML (struktura <table>), co gwarantuje bezbłędne wklejenie danych do istniejącej tabeli w MS Word.
[KLUCZOWE MODUŁY I FUNKCJE]
1. Kalkulator Estymacji (Dynamiczna Tabela Wyceny) Silnik wyliczający koszty na podstawie estymacji zespołu i narzutów projektowych.
Edytor Pozycji (Wierszy): Domyślna lista zasilana standardowymi fazami (Projekt zmian, Kodowanie, Testy, Implementacja, Szkolenia, Aktualizacja dokumentacji, Inne). Użytkownik może swobodnie dodawać, usuwać i zmieniać nazwy wierszy. Stan ten jest trwale zapisywany w kontekście projektu.
Mechanizm Przeliczania (Współczynnik): Wprowadzenie dwóch kolumn dla czasu pracy.
Roboczogodziny bazowe (surowe dane od zespołu).
Współczynnik (np. 1.2 dla 20% bufora).
Liczba godzin końcowa (wynik mnożenia).
Ręczne Nadpisywanie: PM może w dowolnej chwili ręcznie edytować wartość w kolumnie Liczba godzin końcowa. Edycja tej komórki podświetla ją i tymczasowo ignoruje wzór mnożnika, dając PM-owi pełną decyzyjność.
Kolumna Finansowa i Podsumowanie: Automatyczne wyliczanie Kwoty razem (Liczba godzin końcowa × Stawka). Pasek podsumowania na dole tabeli ("Suma godzin", "Suma kwot") aktualizowany w czasie rzeczywistym.
2. Menedżer Harmonogramu (Dual-Mode Scheduler) Moduł pozwalający na elastyczne definiowanie terminów, dopasowujący się do skali wyceny. Użytkownik wybiera jeden z dwóch wariantów (wybór jest zapamiętywany dla projektu):
Wariant A (Uproszczony): Tylko dwa pola kalendarzowe: "Data rozpoczęcia zlecenia" i "Data zakończenia zlecenia".
Wariant B (Kroki Milowe): Dynamiczna tabela z kolumnami "Zadanie" oraz "Termin". Domyślnie zaciąga nazwy pozycji z Tabeli Wyceny (np. Kodowanie, Testy, Implementacja), pozwalając na szybkie przypisanie konkretnych dat i dodanie dodatkowych etapów (np. "Poprawa błędów").
3. Moduł Smart Copy (Eksport do MS Word) Eliminacja konieczności używania bibliotek takich jak docx
 dla prostych operacji wklejania danych.
Przycisk "Kopiuj do formularza Word": Pobiera z lokalnej bazy wyłącznie kolumny wyjściowe: Liczba Godzin, Stawka za godzinę, Kwota razem.
Niewidoczne formatowanie: Aplikacja parsuje te dane do systemowego schowka jako fragment tabeli HTML. Dzięki temu, po naciśnięciu Ctrl+V w programie MS Word, dane idealnie "wpadają" w puste komórki docelowego dokumentu ofertowego bez modyfikacji czcionek czy marginesów.
[PRZYKŁAD ZASTOSOWANIA] (User Flow)
Kontekst: PM przygotowuje wycenę do stałego klienta (projekt X), dla którego formularz ofertowy w Wordzie jest rygorystyczny i wymaga specyficznych informacji.
Inicjalizacja: PM wchodzi w zakładkę "Wycena". System ładuje układ wierszy pamiętany z poprzedniej wyceny dla projektu X. Stawka domyślna to 150 PLN.
Kalkulacja z buforem: PM wprowadza estymacje od zespołu (np. Kodowanie: 40h). Ustawia globalny współczynnik na 1.25. System wylicza Liczbę godzin końcową na 50h.
Korekta ręczna: PM uznaje, że na testy wystarczy sztywne 15h, więc pomija współczynnik i z palca wpisuje 15 w kolumnę Liczba godzin końcowa. Wszystkie kwoty automatycznie się przeliczają.
Harmonogram: PM widzi, że dla tego projektu włączony jest domyślnie Harmonogram Szczegółowy. Przypisuje daty do wygenerowanych wierszy (Kodowanie -> 06.04.2026, Testy -> 07.04.2026).
Transfer do Worda: PM klika przycisk "Kopiuj dla Worda". Otwiera swój szablon docx, zaznacza pierwszą komórkę odpowiedniej tabeli i wkleja. Godziny, stawki i sumy precyzyjnie wypełniają dokument.