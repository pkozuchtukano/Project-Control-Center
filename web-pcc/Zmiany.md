## Logowanie Firebase

- 2026-04-08 - Uczytelniono komunikaty błędów logowania Google
  -- Dodano mapowanie najczęstszych błędów Firebase Auth na czytelne komunikaty po polsku w module `src/lib/firebase.ts`.
  -- Ekran logowania pokazuje teraz konkretną przyczynę błędu i wskazuje dalszy krok, np. włączenie providera Google w Firebase Console dla `auth/operation-not-allowed`.

## Konfiguracja YouTrack

- 2026-04-08 - Naprawiono odczyt bazowego adresu YouTrack z env
  -- Moduł `src/lib/env.ts` odczytuje teraz `VITE_YOUTRACK_BASE_URL` i zachowuje kompatybilność wsteczną z `VITE_PUBLIC_YOUTRACK_BASE_URL`.
  -- Linki do zgłoszeń YouTrack w widokach `Daily` i `Status` korzystają z adresu zgodnego z konfiguracją projektu zamiast nieprawidłowego fallbacku.

- 2026-04-08 - Dodano lokalny endpoint proxy YouTrack dla Vite Dev Server
  -- Wspólna logika proxy została przeniesiona do modułu `server/youtrackProxy.ts`, używanego przez funkcję Netlify i lokalny middleware Vite.
  -- Żądania `POST /api/youtrack` przestają zwracać 404 przy uruchomieniu przez `npm run dev`, więc test połączenia i pobieranie danych działają także lokalnie.
