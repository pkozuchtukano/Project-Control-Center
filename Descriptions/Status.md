### KONTEKST (K)
Celem jest budowa modułu „Status” Zakładki w każdym projekcie, który służy do przygotowania i przeprowadzenia periodycznego spotkania statusowego z klientem. Moduł musi agregować dane z YouTrack (zadania, komentarze, daty) oraz lokalnej bazy (notatki z zakładki Daily) i prezentować je w formie edytowalnej „opowieści” (storytelling) na interaktywnej kanwie. Kluczowe jest filtrowanie po datach (domyślnie od ostatniego spotkania) oraz dostęp do historii poprzednich raportów w panelu bocznym.

### ROLA (R)
Jesteś Senior Fullstack Developerem i Architektem Systemowym specjalizującym się w ekosystemie React, Electron oraz integracjach API (YouTrack). Twoim zadaniem jest zaprojektowanie czystej architektury, która łączy dane zdalne z lokalnym stanem edytowalnym.

### AKCJA (A)
Zaproponuj kompletną implementację podzieloną na następujące kroki:

1. **Logika Agregacji Danych (Data Orchestrator):**
   - Stwórz funkcję/hook, który pobiera zadania z YouTrack API dla konkretnego `projectID` (z konf.) i zakresu dat.
   - Zintegruj te dane z lokalnymi notatkami (Daily Notes) przypisanymi do `issueID`.
   - Zmapuj te dane na obiekt `StatusStory`, zawierający: ID (z linkiem), Tytuł, Datę rozpoczęcia, Opis techniczny i listę wszystkich komentarzy.

2. **Interaktywny Edytor (Status Canvas):**
   - Przygotuj główną sekcję jako edytowalną kanwę (wykorzystaj np. bibliotekę typu TipTap lub Slate, lub zaawansowany ContentEditable).
   - Każde zadanie zaciągnięte z YouTrack musi być osobnym blokiem, który użytkownik może dowolnie modyfikować, dopisywać własne wnioski lub usuwać zbędne techniczne detale przed spotkaniem.

3. **Panel Historii (Sidebar):**
   - Stwórz prawy panel z listą archiwalnych spotkań statusowych pobieranych z lokalnej bazy.
   - Zaimplementuj mechanizm Tooltip/Modal: najechanie pokazuje podgląd, kliknięcie otwiera pełny widok w modalu.
   - Dodaj funkcjonalność: "Kopiuj zaznaczenie do bieżącego statusu".

4. **Interfejs Użytkownika (UI):**
   - Layout: Dwukolumnowy (70% Edytor / 30% Historia).
   - Filtry: DatePicker (zakres od-do) z przyciskiem "Odśwież dane z YouTrack".
   - Wizualizacja: Każde zadanie musi mieć wyraźny ID z aktywnym hyperlinkiem do przeglądarki, linkiem do zadania w youtrack.

### FORMAT (F)
- **Struktura:** Techniczny Outline -> Interfaces TS -> Przykładowy Kod React (Główny komponent + Logika mapowania) -> Struktura Bazy Danych (Notatki/Historia).
- **Styl:** Czysty kod (Clean Code), TypeScript, nowoczesne Hooki.
- **Długość:** Szczegółowa specyfikacja z kluczowymi fragmentami kodu.

### TARGET (T)
Odbiorcą jest PM. Kod musi uwzględnieniać dobrych praktyki UX dla narzędzi typu „internal productivity tools”.

---
**ZAŁOŻENIA:** Zweryfikuj istniejącą logikę aplikacji, połaczenia zyoutrack i lokalną bazą danych.
**WYTYCZNE JAKOŚCI:** Unikaj generycznych opisów. Pokaż konkretną strukturę obiektu, który łączy komentarze YouTrack z ręcznymi notatkami Daily. Linkowanie zadań musi obsługiwać standardowy format `[PROJECT-ID-123]`.
**PARAMETRY WYJŚCIA:** React (Functional Components), TypeScript, Styled-components/Tailwind CSS.
