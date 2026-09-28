# Pobieranie danych YouTrack za authentik

Najnowsza aktualizacja implementacji: utrata autoryzacji podczas pobierania otwiera wspólny modal i wstrzymuje oczekujące odczyty. Po potwierdzeniu logowania przez API przerwane żądanie jest ponawiane automatycznie, najwyżej raz; synchronizacja kontynuuje pobieranie. Anulowanie kończy oczekujące żądania błędem. Logowanie odnawia sesję authentik, nie generuje nowego tokena API YouTrack. Test obejmuje współbieżne pobrania, anulowanie, kolejną synchronizację po anulowaniu i stały błąd uprawnień. Starszy opis ręcznego ponawiania poniżej dotyczy pierwszej wersji.

Data analizy: 23.09.2026. Zakres: kod PCC (Electron/React), pomocniczo wariant web-pcc oraz oficjalna dokumentacja authentik, YouTrack i Electron.

Aktualizacja po wyborze wariantu C: dodano w kodzie PCC logowanie w oknie Electron oraz wklejanie linku z e-maila (Ustawienia Główne > YouTrack / authentik). Przycisk sprawdzenia połączenia weryfikuje konto przez API; po sukcesie użytkownik ponawia pobieranie. Wspólny transport używa osobnej sesji dla serwera, wymaga HTTPS i blokuje żądania do innych domen oraz automatyczne przekierowania API. Token YouTrack pozostaje wymagany. Test automatyczny używa atrap Electron/sieci; przeszedł również TypeScript i build Vite. Faktyczne logowanie e-mailowe, trwałość sesji po restarcie oraz załączniki wymagają próby na wdrożeniu. Poniższe rozdziały zachowują ustalenia z analizy sprzed implementacji.

**Wniosek: integracja jest możliwa. Logowanie linkiem z e-maila nie wyklucza dostępu API. O wyborze rozwiązania decyduje to, czy authentik chroni również żądania API, oraz czy administrator dopuszcza dostęp maszynowy.**

Analiza nie obejmowała testu działającego serwera użytkownika: nie otrzymałem adresu instancji, wersji wdrożenia ani konfiguracji providera/reverse proxy. Poniżej odróżniam fakty z kodu i dokumentacji od propozycji wymagających próby na tej instalacji. Nie zmieniałem kodu aplikacji ani konfiguracji zabezpieczeń.

## 1. Co oznacza logowanie przez e-mail

Opis użytkownika odpowiada logowaniu typu magic link: użytkownik potwierdza dostęp do skrzynki, a przeglądarka uzyskuje sesję. authentik posiada Email stage wysyłający tokenizowane linki z konfigurowalną ważnością. Sam opis nie rozstrzyga jednak, czy użyto tego etapu, zewnętrznego dostawcy tożsamości, OIDC/SAML, czy bramy proxy. Link e-mailowy nie jest stałym tokenem do API YouTrack. [Email stage](https://docs.goauthentik.io/add-secure-apps/flows-stages/stages/email/).

Możliwe topologie:

1. **authentik jako dostawca logowania SSO:** YouTrack przekierowuje użytkownika podczas logowania, lecz jego API może przyjmować własny token bez interakcji z authentik.
2. **authentik przed całym YouTrack:** proxy lub forward auth sprawdza również `/api/...`; potrzebne jest przejście bramy oraz autoryzacja w YouTrack.
3. **Połączenie obu mechanizmów:** osobno ochrona ruchu i logowanie SSO.

Dlatego nie należy zakładać, że wdrożenie authentik automatycznie unieważniło dotychczasowy token YouTrack. Najpierw trzeba ustalić, która warstwa odrzuca żądanie.

## 2. Co obecnie robi PCC

| Miejsce w kodzie | Ustalenie i znaczenie |
|---|---|
| `src/services/youtrackApi.ts:4` i `:119` | Wysyła token YouTrack jako `Authorization: Bearer ...`; w desktopie korzysta z IPC, poza nim z Axios. |
| `electron/main.ts:39` | Wspólna funkcja transportowa używa już `net.fetch`. To dobry punkt do dodania obsługi sesji. |
| `electron/main.ts:1523` | Handler IPC przekazuje nagłówki i pobiera JSON lub dane binarne. Nie klasyfikuje strony logowania jako wygaśnięcia sesji. |
| `electron/main.ts:2237` | Druga ścieżka JSON, wykorzystywana przez raportowanie, korzysta z tego samego transportu. Zmiana tylko komponentu YouTrack byłaby niewystarczająca. |
| `src/services/youtrackApi.ts:219`, `:267`, `:530` | Pobierane są zadania, aktywności i wpisy czasu pracy. |
| `src/components/AuthenticatedImage.tsx` | Obrazy korzystają z IPC i tokena; również muszą działać po zmianie autoryzacji. |
| `src/features/daily/components/DailyIssueDetailsModal.tsx:45` | Część adresów otrzymuje `access_token` w query string. Przy wdrożeniu należy przeanalizować tę ścieżkę osobno i preferować transport z nagłówkiem, aby nie utrwalać tokena w URL. |
| `electron/main.ts:1210` i `:5558` | Linki są otwierane przez `shell.openExternal`, czyli poza sesją sieciową aplikacji. |
| `web-pcc/server/youtrackProxy.ts:19` | Wariant serwerowy używa Axios z tokenem; nie dziedziczy ciasteczek przeglądarki użytkownika ani Electrona. |

W przejrzanych ścieżkach nie ma dedykowanego logowania authentik ani odnowienia jego sesji. Jeżeli przekierowanie kończy się stroną HTML z kodem 200, obecne `response.json()` może zgłosić błąd parsowania zamiast komunikatu „Zaloguj się ponownie”.

Electron `net.fetch` używa domyślnej sesji Chromium; `session.fetch` umożliwia wskazanie innej sesji. Wynika z tego możliwość współdzielenia sesji przez okno logowania i klienta API, ale nie współdzielenia jej z osobnym Chrome/Edge. [Electron session](https://www.electronjs.org/docs/latest/api/session).

## 3. Porównanie wariantów

Poniższa ocena nakładu i przydatności jest oceną projektową na podstawie sprawdzonego kodu.

| Wariant | Współpraca administratora | Pobieranie bez klikania e-maila | Ocena dla PCC |
|---|---|---|---|
| A. Obecny token, API nie jest chronione bramą | Weryfikacja konfiguracji | Tak | Najpierw sprawdzić; możliwe, że wystarczy istniejąca integracja |
| B. Dedykowana ścieżka API/VPN + token YouTrack | Tak | Tak | Najprostsza trwała opcja dla synchronizacji |
| C. Sesja authentik w Electronie + token YouTrack | Czasem, zależnie od polityk | Do wygaśnięcia sesji | Rozsądny wariant interaktywny, wymaga próby magic link |
| D. M2M authentik + osobna autoryzacja YouTrack | Tak | Tak | Możliwe, lecz trzeba rozwiązać przekazywanie dwóch poświadczeń |
| E. OAuth YouTrack/Hub | Rejestracja klienta i zgodna wersja | Zależnie od tokenów i odświeżania | Dobre dla produktu wieloużytkownikowego; większy zakres zmian |

### A/B. Token YouTrack i uzgodniony dostęp do API

YouTrack oficjalnie obsługuje permanent tokens. Token działa z uprawnieniami konta i zakresem usługi; konto do odczytu powinno mieć tylko potrzebne uprawnienia do projektów, zadań i czasu pracy. Brak hasła używanego przy codziennym logowaniu nie oznacza braku możliwości utworzenia tokena. Dostępność tej opcji zależy również od uprawnień i użycia wbudowanego lub zewnętrznego Hub. [Tokeny YouTrack](https://www.jetbrains.com/help/youtrack/devportal/Manage-Permanent-Token.html), [autoryzacja żądań](https://www.jetbrains.com/help/youtrack/devportal/authentication-with-permanent-token.html).

Jeżeli brama blokuje API, administrator może udostępnić dokładnie potrzebne ścieżki bez interaktywnego logowania authentik, pozostawiając kontrolę tokena w YouTrack. authentik dokumentuje `Unauthenticated Paths` i `Unauthenticated URLs`; znaczenie reguły zależy od trybu providera. [Proxy provider](https://docs.goauthentik.io/add-secure-apps/providers/proxy/).

**Propozycja dla wdrożenia:** zamiast szerokiego wyjątku rozważyć adres integracyjny ograniczony sieciowo, VPN lub listę dozwolonych klientów. Reguła musi uwzględniać rzeczywisty prefiks instalacji, np. `/youtrack/api/`, oraz wymagane załączniki. Wyłączenie kontroli bramy zmienia granicę ochrony, dlatego to decyzja administratora. Konieczny jest test, że żądanie bez tokena nie zwraca chronionych danych; trzeba uwzględnić uprawnienia konta anonimowego.

Korzyść: PCC może zachować obecny sposób pobierania danych. Dostęp maszynowy pozostaje niezależny od sesji e-mailowej użytkownika.

### C. Logowanie w oknie PCC i sesja authentik

Proponowany przebieg:

1. PCC otwiera osobne, izolowane okno logowania na adres chronionego YouTrack.
2. Użytkownik wpisuje e-mail i kończy logowanie linkiem.
3. Okno oraz wywołania API używają tej samej sesji, np. trwałej partycji `persist:youtrack` i jej `session.fetch`.
4. API otrzymuje ciasteczko bramy oraz token YouTrack; po wygaśnięciu sesji PCC prosi o ponowne logowanie.

**Najważniejszy warunek:** link z e-maila musi zakończyć przepływ w kontekście, który udostępni sesję PCC. Zwykłe kliknięcie otwierające Edge/Chrome tego nie zapewnia. Można rozważyć otwarcie skopiowanego linku w oknie PCC, ale dopiero próba na konkretnym flow potwierdzi zachowanie powiązania tokena z sesją i przekierowaniami. Nie należy obiecywać, że samo otwarcie zewnętrznej przeglądarki rozwiąże problem.

Zdalne okno powinno mieć wyłączone Node integration, włączoną izolację, ograniczone dozwolone domeny i nie mieć mostka IPC aplikacji. Linków i ciasteczek nie zapisujemy w logach. Trwała partycja nie przedłuża ważności sesji ustalonej przez serwer.

Ten wariant pasuje do ręcznej pracy. Raporty uruchamiane w tle nadal mogą wymagać interwencji po wygaśnięciu sesji. Nie rekomenduję ręcznego eksportowania cookies z Chrome jako docelowej integracji.

### D. Uwierzytelnianie maszynowe authentik

authentik dokumentuje M2M przez grant `client_credentials`, m.in. z nazwą użytkownika i app password. Przykładowym endpointem jest `/application/o/token/`. Dla proxy potrzebny jest token wydany dla właściwego providera oraz polityka zezwalająca kontu na dostęp. Administrator musi potwierdzić obsługę w zainstalowanej wersji. [M2M authentik](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/machine_to_machine).

**Ograniczenie krytyczne:** token authentik i token YouTrack nie są zamienne. Oba mechanizmy mogą korzystać z `Authorization`. Dokumentacja authentik opisuje przechwytywanie tego nagłówka i usuwanie poprawnie rozpoznanych poświadczeń przed wysłaniem do aplikacji. Zwykły token API authentik nie jest też automatycznie poprawnym Bearerem proxy. [Header authentication](https://docs.goauthentik.io/add-secure-apps/providers/proxy/header_authentication).

Możliwe projekty rozwiązania, wymagające walidacji:

- Najpierw uwierzytelnić bramę, zachować otrzymane cookies, następnie używać cookies z tokenem YouTrack. Trzeba sprawdzić przekazywanie Bearera YouTrack, ustawienie `Intercept header authentication` i zachowanie po wygaśnięciu sesji.
- W kontrolowanej konfiguracji reverse proxy rozdzielić poświadczenia bramy i aplikacji. To konfiguracja infrastruktury, a nie możliwość wpisania dwóch Bearerów do obecnego pola tokena.
- Uruchomić mały backend integracyjny w sieci YouTrack, który obsłuży wymagany mechanizm dostępu i zwróci PCC potrzebne dane. Wspólnego sekretu usługi nie należy zaszywać we wszystkich kopiach desktopowej aplikacji.

### E. OAuth YouTrack/Hub

OAuth uzyskuje token dostępu do YouTrack w imieniu użytkownika i może zastąpić ręczne kopiowanie permanent tokena. Aktualna dokumentacja zaleca Authorization Code z PKCE dla nowych aplikacji i wskazuje zarządzanie klientami bezpośrednio w YouTrack od wersji 2026.2; inne instalacje wymagają sprawdzenia możliwości Hub. [OAuth YouTrack](https://www.jetbrains.com/help/youtrack/devportal/OAuth-authorization-in-youtrack.html).

To osobny mechanizm od tokena OAuth wystawianego przez authentik. Nawet poprawny token YouTrack/Hub nie usuwa dodatkowej bramy proxy. W takim wdrożeniu nadal potrzebny jest wariant B, C lub D. Dlatego OAuth nie jest pierwszym wyborem do samego przywrócenia obecnej synchronizacji PCC.

## 4. Rekomendacja i plan weryfikacji

**Rekomenduję najpierw sprawdzić obecny token na API bez sesji przeglądarkowej. Jeżeli blokuje go brama, uzgodnić z administratorem wariant B. Gdy zmiana infrastruktury nie jest dostępna, wykonać ograniczoną próbę wariantu C. Do pracy całkowicie automatycznej wybrać B albo dopracowany wariant D.**

Minimalne informacje od administratora:

- Wersje authentik, outposta i YouTrack; wbudowany czy zewnętrzny Hub.
- Typ providera: OIDC/SAML, proxy czy forward auth; rodzaj reverse proxy.
- Czy API i pliki są chronione bramą oraz czy przechwytywany jest `Authorization`.
- Czy można wystawić token YouTrack, konto integracyjne lub app password authentik.
- Jakie są czasy życia sesji i czy flow e-mailowe dopuszcza zakończenie logowania w Electronie.

Test diagnostyczny powinien używać żądania GET do rzeczywistego bazowego adresu YouTrack, np. `/api/users/me?fields=id,login`, a następnie `/api/issues?fields=id,idReadable&$top=1`. Na początku należy wyłączyć automatyczne podążanie za przekierowaniami i sprawdzić status, `Location` oraz `Content-Type`, bez logowania sekretów:

| Wynik | Interpretacja |
|---|---|
| 200 i oczekiwany JSON | Potwierdzenie dostępu do tego endpointu; następnie sprawdzić pozostałe dane |
| 302/303 do authentik | Brama wymaga uwierzytelnienia |
| 200 i HTML logowania | Najprawdopodobniej klient podążył za przekierowaniem; nie jest to sukces API |
| 401/403 | Ustalić emitenta odpowiedzi; może to być brama, zły token lub brak uprawnień YouTrack |

Po wybraniu wariantu test akceptacyjny powinien objąć zadania, historię, wpisy czasu, obrazy/załączniki, raport uruchamiany w tle, restart PCC, wygaśnięcie sesji i odwołanie tokena. Przerwana autoryzacja nie powinna powodować zapisania niepełnego wyniku jako pełnej synchronizacji.

W kodzie należy przede wszystkim wykorzystać wspólny transport, rozpoznawać odpowiedzi logowania, ograniczyć przekazywanie poświadczeń do dozwolonych adresów oraz obsłużyć ponowną autoryzację. Dla web-pcc trzeba osobno zapewnić dostęp serwerowego klienta Axios; zalogowanie desktopu nie uwierzytelni funkcji Netlify. Jego obecny `healthcheck` sprawdza jedynie obecność konfiguracji, a nie rzeczywiste połączenie.

**Status:** analiza statyczna i dokumentacyjna zakończona. Warianty nie zostały przetestowane na instalacji użytkownika; raport nie potwierdza jej konkretnej topologii ani dostępności uprawnień administracyjnych.
