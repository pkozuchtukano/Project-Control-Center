WIZJA PRODUKTU: ZAKŁADKA NOTATKI (Meeting Notes & Sync)
[DIAGNOZA PROBLEMÓW]
Rozproszenie ustaleń ze spotkań: Notatki tworzone ad-hoc w różnych narzędziach tekstowych łatwo giną, co utrudnia śledzenie podjętych decyzji projektowych.
Ręczne tworzenie list obecności: Ciągłe, ręczne wpisywanie tych samych interesariuszy i weryfikowanie ich obecności na każdym spotkaniu jest powtarzalnym i nieefektywnym procesem.
Brak standaryzacji formatu: Różne formaty notatek wprowadzają chaos informacyjny przy przeglądaniu historii projektu przez klienta lub zespół.
Czasochłonne udostępnianie (Kopiuj-Wklej): PM musi ręcznie kopiować sformatowane notatki ze swojego edytora do współdzielonego z klientem dokumentu Google, co grozi utratą formatowania.
[STRATEGIA INTEGRACJI Z GOOGLE DOCS]
Aplikacja wykorzystuje architekturę Local-First do zarządzania szablonami i listami osób, a integrację z Google Docs API realizuje w modelu "Append-Only" (tylko dopisywanie).
Pobieranie i składowanie danych (Baza Lokalna): Aplikacja pobiera z bazy SQLite zdefiniowane wcześniej dla danego projektu listy osób (podział na "Zamawiający" i "Wykonawca"). Konfiguracja przechowuje również link / ID docelowego dokumentu Google przypisanego do danego projektu.
Przetwarzanie w aplikacji (Logika UI): Stan zaznaczenia checkboxów obecności oraz treść notatki (z edytora blokowego) są transformowane w pamięci do ustrukturyzowanego obiektu JSON.
Wynik w Google Docs (Eksport): Po kliknięciu "Zapisz", aplikacja autoryzuje się za pomocą OAuth (Google Identity) i wysyła zapytanie documents.batchUpdate do Google Docs API. Nowy blok tekstu (Tytuł, Lista obecnych, Treść) jest wstrzykiwany na sam koniec zdefiniowanego dokumentu którego link udostepniania jest w konfiguracji projektu, nie naruszając jego wcześniejszej historii.
[KLUCZOWE MODUŁY I FUNKCJE]
1. Menedżer Konfiguracji Projektu (Ustawienia)
Rejestr Dokumentów: Globalne dla projektu pole w ustawieniach na wklejenie linku (lub ID) docelowego pliku Google Docs.
W zakładce notatki Katalog Interesariuszy: Panel pozwalający PM-owi raz zdefiniować pełną pulę osób ze strony Zamawiającego oraz Wykonawcy. Stan ten zapisywany jest trwale w lokalnej bazie SQLite i ładowany przy każdej nowej notatce.
2. Generator Notatki (Zakładka "Notatki")
Nagłówek i Metadane: Pole tekstowe na "Tytuł spotkania" .
Dynamiczny Moduł Obecności (Checkboxy): Dwie wygenerowane listy z nazwiskami (Zamawiający / Wykonawca). Domyślnie checkboxy są zaznaczone i pamiętany jest ich stan z poprzedniej notatki. Zaznaczenie checkboxa kwalifikuje daną osobę do listy osób Po stronie zamawiającego oraz Po stronie Tukano Software House (wykonawca) w finalnym dokumencie. Niezaznaczone osoby są pomijane w eksporcie.
Edytor Treści: Zintegrowany edytor typu Rich-Text (np. BlockNote/Tiptap zaimplementowany w React), pozwalający na łatwe tworzenie list wypunktowanych, pogrubień ustaleń i wklejanie zrzutów ekranu.
3. Silnik Synchronizacji z Google Docs (Google API Connector)
Kompilator Dokumentu: Mechanizm, który tłumaczy zawartość edytora React (HTML/JSON) oraz stany checkboxów na format zrozumiały dla Google Docs API (struktura InsertTextRequest i ułożenie akapitów).
Append-Action: Akcja podpięta pod przycisk "Zapisz", wykonująca dodanie nagłówka z tytułem, wylistowanie obecnych z podziałem na role, a następnie wklejenie głównej treści – zawsze na końcu pliku (EOF - End of File). Wstawia również wizualny separator (np. linię poziomą) odcinający nowe spotkanie od poprzednich.
[PRZYKŁAD ZASTOSOWANIA] (User Flow)
Kontekst: Cotygodniowe spotkanie statusowe z klientem (Sync Weekly).
Przygotowanie (Jednorazowe): W ustawieniach projektu PM wkleja link do współdzielonego pliku "Status_Projektu_X.gdoc" i definiuje listę 5 osób od klienta oraz 4 osób z zespołu deweloperskiego.
Rozpoczęcie spotkania: PM otwiera zakładkę "Notatki". Wpisuje tytuł: "Notatka ze spotkania w dniu {{data}} 11:30". Tytuł zostaje zapamiętany. Zastosuj mechanizm szablonów który już działa w aplikacji w zakładce "Wycena".
Sprawdzenie obecności: PM rzuca okiem na listę uczestników na komunikatorze. Szybko modyfikuje checkboxy przy osobach faktycznie obecnych lub nieobecnych na spotkaniu w panelach "Zamawiający" i "Wykonawca".
Notowanie: PM na bieżąco zapisuje w edytorze najważniejsze decyzje w punktach (np. "Akceptacja makiety panelu logowania", "Przesunięcie wdrożenia na piątek").
Eksport: Spotkanie się kończy. PM klika przycisk "Zapisz". Aplikacja przez API Google dodaje do udostępnionego przez link w ustawieniach pliku nową, sformatowaną sekcję. Klient otwierając swój plik Google Doc, natychmiast widzi dopisaną dzisiejszą notatkę na samym dole dokumentu. Treść notatki możemy wyczyścić w aplikacji . Zapamiętuj obecności osób (checkboxy) i tytuł . Tego nie czyść bo z reguły się powtarza i tak formularz przygotowany jest na kolejne spotkanie.
Tytuł , osoby jest definiowana i apamietywana. Uwzględnij system szablonów jak w zakładce "Wycena". 