# PCC Web

Webowa replika modu³ów `Daily` i `Status` z aplikacji PCC.

## Uruchomienie

1. WejdŸ do katalogu `web-pcc`.
2. Uzupe³nij zmienne `VITE_FIREBASE_*`, `VITE_YOUTRACK_BASE_URL` oraz po stronie Netlify `YOUTRACK_BASE_URL`, `YOUTRACK_TOKEN`.
3. W Firebase Console w³¹cz `Authentication -> Sign-in method -> Google`.
4. Dodaj swój lokalny host do `Authentication -> Settings -> Authorized domains`, np. `localhost`.
5. Uruchom `npm run dev`.
6. Test po³¹czenia i pobieranie danych YouTrack dzia³aj¹ lokalnie przez middleware Vite pod `/api/youtrack`.
7. Zaloguj siê przez Google.

## Regu³y Firestore

Wgraj regu³y z pliku [firestore.rules](./firestore.rules).

Za³o¿enie regu³:
- tylko zalogowany u¿ytkownik ma dostêp do danych,
- ka¿dy dokument jest dostêpny wy³¹cznie dla w³aœciciela `ownerUid == auth.uid`,
- aplikacja zapisuje `ownerUid` automatycznie podczas zapisu dokumentu.

## Zakres

- shell aplikacji z sidebarem projektów i wejœciem do `Daily`
- logowanie przez Firebase Auth (Google)
- `Daily` z hubami, sekcjami, filtrami, kartami i notatkami PM
- `Status` z edytorem, Ÿród³ami, histori¹ raportów i linkami projektowymi
- repozytoria przygotowane pod Firestore oraz przysz³¹ synchronizacjê z desktopem
- Netlify Function jako bezpieczny proxy do YouTrack

## Uwagi

- Drafty `Status` i czêœæ stanów UI s¹ lokalne w `localStorage`.
- Dane wspó³dzielone korzystaj¹ z Firestore, a lokalnie maj¹ fallback do `localStorage`.
- Gdy Firestore odrzuci dostêp, aplikacja nie przerywa startu i przechodzi na lokalny fallback.
- Testy integracyjne s¹ na razie szkieletem pod docelowy runner browserowy.
