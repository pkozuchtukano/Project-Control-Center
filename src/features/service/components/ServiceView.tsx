import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Edit2,
  Loader2,
  Plus,
  ShieldCheck,
  Siren,
  Upload,
  X,
} from 'lucide-react';

import type { Project, ServiceEvent, ServiceEventType, ServiceObligation, ServiceRelativeUnit, ServiceScheduleType, ServiceTask } from '../../../types';
import { ProjectLinksDropdown } from '../../project-links/components/ProjectLinksMain';

type ServiceAlertPayload = {
  taskId: string;
  projectId: string;
  projectCode?: string;
  projectName?: string;
  obligationCode?: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'overdue';
};

type ServiceViewProps = {
  project: Project;
  alerts?: ServiceAlertPayload[];
};

type ServiceOverviewState = {
  obligations: ServiceObligation[];
  tasks: ServiceTask[];
  events: ServiceEvent[];
};

type ObligationSeed = Omit<ServiceObligation, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>;

const createClientId = (prefix: string) =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? `${prefix}_${crypto.randomUUID()}`
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

const createTimestamp = () => new Date().toISOString();

const formatDateTime = (value?: string) => {
  if (!value) return 'Brak terminu';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatShortDate = (value?: string) => {
  if (!value) return 'Brak daty';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('pl-PL');
};

const getScheduleLabel = (obligation: ServiceObligation) => {
  switch (obligation.scheduleType) {
    case 'none':
      return 'Ciągłe monitorowanie';
    case 'fixed_date':
      return obligation.fixedDate ? `Jednorazowo do ${formatShortDate(obligation.fixedDate)}` : 'Jednorazowy termin';
    case 'monthly':
      return 'Cyklicznie co miesiąc';
    case 'quarterly':
      return 'Cyklicznie co kwartał';
    case 'semiannual':
      return 'Cyklicznie co 6 miesięcy';
    case 'annual':
      return 'Cyklicznie co rok';
    case 'relative': {
      const value = obligation.relativeValue || 0;
      const unitLabel =
        obligation.relativeUnit === 'hours'
          ? 'godzin'
          : obligation.relativeUnit === 'business_days'
          ? 'dni roboczych'
          : obligation.relativeUnit === 'months'
            ? 'miesiąca / miesięcy'
            : 'dni kalendarzowych';
      return `Po zdarzeniu: ${value} ${unitLabel}${obligation.triggerLabel ? ` od "${obligation.triggerLabel}"` : ''}`;
    }
    default:
      return 'Brak harmonogramu';
  }
};

const getRelativeUnitLabel = (unit?: ServiceRelativeUnit) => {
  switch (unit) {
    case 'hours':
      return 'godziny';
    case 'business_days':
      return 'dni robocze';
    case 'months':
      return 'miesiące';
    default:
      return 'dni kalendarzowe';
  }
};

const getObligationScheduleDetails = (obligation: ServiceObligation) => {
  switch (obligation.scheduleType) {
    case 'none':
      return {
        schedule: 'Ciągłe monitorowanie',
        amountUnit: 'Nie dotyczy',
        trigger: 'Stały obowiązek',
      };
    case 'fixed_date':
      return {
        schedule: 'Jednorazowy termin',
        amountUnit: '1 termin',
        trigger: obligation.fixedDate ? formatShortDate(obligation.fixedDate) : 'Brak daty',
      };
    case 'monthly':
      return {
        schedule: 'Cykliczny',
        amountUnit: '1 miesiąc',
        trigger: obligation.anchorDate ? `od ${formatShortDate(obligation.anchorDate)}` : 'Brak daty bazowej',
      };
    case 'quarterly':
      return {
        schedule: 'Cykliczny',
        amountUnit: '3 miesiące',
        trigger: obligation.anchorDate ? `od ${formatShortDate(obligation.anchorDate)}` : 'Brak daty bazowej',
      };
    case 'semiannual':
      return {
        schedule: 'Cykliczny',
        amountUnit: '6 miesięcy',
        trigger: obligation.anchorDate ? `od ${formatShortDate(obligation.anchorDate)}` : 'Brak daty bazowej',
      };
    case 'annual':
      return {
        schedule: 'Cykliczny',
        amountUnit: '1 rok',
        trigger: obligation.anchorDate ? `od ${formatShortDate(obligation.anchorDate)}` : 'Brak daty bazowej',
      };
    case 'relative':
      return {
        schedule: 'Po zdarzeniu',
        amountUnit: `${obligation.relativeValue || 0} ${getRelativeUnitLabel(obligation.relativeUnit)}`,
        trigger: obligation.triggerLabel || 'Brak wyzwalacza',
      };
    default:
      return {
        schedule: 'Brak harmonogramu',
        amountUnit: 'Nie dotyczy',
        trigger: 'Brak',
      };
  }
};

const getEventTypeLabel = (eventType: ServiceEventType) => {
  switch (eventType) {
    case 'incident':
      return 'Incydent / wada';
    case 'security_patch':
      return 'Poprawka bezpieczeństwa';
    case 'audit':
      return 'Audyt / zalecenie';
    case 'consultation':
      return 'Konsultacja';
    case 'backup':
      return 'Backup / archiwizacja';
    case 'update':
      return 'Aktualizacja';
    case 'migration':
      return 'Migracja';
    default:
      return 'Inne';
  }
};

const createEmptyObligation = (projectId: string): ServiceObligation => {
  const timestamp = createTimestamp();
  return {
    id: createClientId('service_obligation'),
    projectId,
    code: '',
    title: '',
    description: '',
    kind: 'continuous',
    scheduleType: 'none',
    intervalValue: 1,
    relativeValue: 3,
    relativeUnit: 'business_days',
    fixedDate: '',
    anchorDate: format(new Date(), 'yyyy-MM-dd'),
    triggerLabel: '',
    owner: '',
    evidenceHint: '',
    notes: '',
    sourceRequirement: '',
    requiresProtocol: false,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createEmptyEvent = (projectId: string, obligations: ServiceObligation[]): ServiceEvent => {
  const timestamp = createTimestamp();
  return {
    id: createClientId('service_event'),
    projectId,
    obligationId: obligations.find((item) => item.kind === 'event')?.id || '',
    eventType: 'other',
    title: '',
    occurredAt: timestamp.slice(0, 16),
    dueDate: '',
    reference: '',
    notes: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const TemplateManagerModal = ({
  isOpen,
  isBusy,
  sampleCount,
  baseDate,
  endDate,
  onBaseDateChange,
  onEndDateChange,
  onClose,
  onExport,
  onImport,
}: {
  isOpen: boolean;
  isBusy: boolean;
  sampleCount: number;
  baseDate: string;
  endDate: string;
  onBaseDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClose: () => void;
  onExport: () => Promise<void>;
  onImport: () => Promise<void>;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Załaduj szablon</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Eksportuj przykładowy schemat JSON albo wczytaj przygotowaną listę obowiązków z zewnętrznego narzędzia.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isBusy} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-900/30">
            <label className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">Data bazowa</label>
            <p className="mb-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Domyślnie jest tu `Data obowiązywania umowy od` z projektu. Ta wartość zostanie zapisana w eksportowanym JSON jako parametr `baseDate`.
            </p>
            <input
              type="date"
              value={baseDate}
              disabled={isBusy}
              onChange={(event) => onBaseDateChange(event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-900/30">
            <label className="mb-2 block text-sm font-semibold text-slate-900 dark:text-white">Data końcowa</label>
            <p className="mb-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Domyślnie jest tu `Data końcowa umowy` z projektu. Ta wartość zostanie zapisana w eksportowanym JSON jako parametr `endDate`.
            </p>
            <input
              type="date"
              value={endDate}
              disabled={isBusy}
              onChange={(event) => onEndDateChange(event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
            />
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-5 dark:border-sky-900/40 dark:bg-sky-500/10">
            <div className="flex items-start gap-3">
              <Download className="mt-0.5 text-sky-600 dark:text-sky-300" size={18} />
              <div className="space-y-2">
                <p className="font-semibold text-slate-900 dark:text-white">1. Eksport przykładowego JSON</p>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Zapisuje plik JSON zgodny ze strukturą zakładki `Obowiązki`. Plik zawiera przykładowy schemat i {sampleCount} przykładowych pozycji,
                  które możesz edytować w zewnętrznym narzędziu.
                </p>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void onExport()}
                  className="rounded-2xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50 disabled:opacity-50 dark:border-sky-900/40 dark:bg-slate-900/40 dark:text-sky-300 dark:hover:bg-sky-500/10"
                >
                  <span className="inline-flex items-center gap-2"><Download size={15} /> Eksportuj przykładowy JSON</span>
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-5 dark:border-emerald-900/40 dark:bg-emerald-500/10">
            <div className="flex items-start gap-3">
              <Upload className="mt-0.5 text-emerald-600 dark:text-emerald-300" size={18} />
              <div className="space-y-2">
                <p className="font-semibold text-slate-900 dark:text-white">2. Wczytanie przygotowanego schematu</p>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Wybierasz gotowy plik JSON z definicją obowiązków. Jeśli w projekcie istnieją już obowiązki, aplikacja zapyta,
                  czy zastąpić bieżącą listę importowaną wersją.
                </p>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void onImport()}
                  className="rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/40 dark:bg-slate-900/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                >
                  <span className="inline-flex items-center gap-2"><Upload size={15} /> Wczytaj schemat JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};

const DEFAULT_ATK_OBLIGATIONS: ObligationSeed[] = [
  {
    code: 'ATK-01',
    title: 'Ciągłość działania 24/7/365',
    description: 'Monitorowanie ciągłości działania systemu poza uzgodnionymi oknami serwisowymi.',
    kind: 'continuous',
    scheduleType: 'none',
    owner: 'PM / zespół utrzymania',
    evidenceHint: 'Monitoring, potwierdzenia incydentów, raport dostępności',
    sourceRequirement: '4.1.1',
    requiresProtocol: false,
    isActive: true,
  },
  {
    code: 'ATK-05',
    title: 'Instalacja poprawek bezpieczeństwa do 3 dni roboczych',
    description: 'Każde wydanie poprawki bezpieczeństwa powinno wygenerować zadanie z terminem 3 dni roboczych od publikacji.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 3,
    relativeUnit: 'business_days',
    triggerLabel: 'wydanie poprawki bezpieczeństwa',
    owner: 'Administrator / utrzymanie',
    evidenceHint: 'Link do wydania producenta, protokół instalacji, zgoda na wydłużenie terminu',
    sourceRequirement: '4.1.1',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-11',
    title: 'Aktualizacja dokumentacji i kodów wraz z protokołem odbioru',
    description: 'Przed rozliczeniem okresu należy wskazać zmiany w dokumentacji i repozytorium oraz dostarczyć komplet materiałów.',
    kind: 'recurring',
    scheduleType: 'monthly',
    anchorDate: format(new Date(), 'yyyy-MM-01'),
    owner: 'PM / lider techniczny',
    evidenceHint: 'Protokół odbioru, commit / paczka źródeł, zaktualizowana dokumentacja',
    sourceRequirement: '4.1.1',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-12',
    title: 'Kwartalny przegląd kodów źródłowych i dokumentacji',
    description: 'Raz na kwartał trzeba potwierdzić przegląd kodów źródłowych i kompletności dokumentacji systemu.',
    kind: 'recurring',
    scheduleType: 'quarterly',
    anchorDate: format(new Date(), 'yyyy-MM-01'),
    owner: 'Architekt / PM',
    evidenceHint: 'Lista zmian, wnioski z przeglądu, potwierdzenie wykonania',
    sourceRequirement: '4.1.1',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-14',
    title: 'Aktualizacja stabilnych wersji producenta',
    description: 'Nowa stabilna wersja producenta powinna być przeanalizowana i wdrożona nie później niż miesiąc po publikacji, po uzgodnieniu z Zamawiającym.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 1,
    relativeUnit: 'months',
    triggerLabel: 'udostępnienie stabilnej wersji producenta',
    owner: 'Administrator / architekt',
    evidenceHint: 'Analiza wpływu, uzgodnienie terminu, potwierdzenie wdrożenia',
    sourceRequirement: '4.1.1',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-15',
    title: 'Instalacja pakietów aktualizacyjnych w oknie serwisowym',
    description: 'Instalacje poprawek usuwających wady powinny być planowane w oknie serwisowym, chyba że ustalono inaczej.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 1,
    relativeUnit: 'calendar_days',
    triggerLabel: 'odbiór pakietu aktualizacyjnego',
    owner: 'Release manager / utrzymanie',
    evidenceHint: 'Plan okna serwisowego, zgoda Zamawiającego, wynik instalacji',
    sourceRequirement: '4.1.1 / 4.1.2',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-17',
    title: 'Migracja systemu na żądanie Zamawiającego',
    description: 'Migracja uruchamia osobny proces: harmonogram, wymagania infrastruktury, akceptacja i dalszą obsługę zgłoszenia.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 1,
    relativeUnit: 'calendar_days',
    triggerLabel: 'zgłoszenie migracji',
    owner: 'PM / architekt infrastruktury',
    evidenceHint: 'Harmonogram migracji, wymagania techniczne, decyzje Zamawiającego',
    sourceRequirement: '4.1.1',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-23/24',
    title: 'Rejestrowanie zgłoszeń w portalu serwisowym',
    description: 'Każde zgłoszenie powinno być rejestrowane i archiwizowane wraz z czasem, treścią i historią obejścia / naprawy.',
    kind: 'continuous',
    scheduleType: 'none',
    owner: 'PM / service desk',
    evidenceHint: 'Portal serwisowy, eksport zgłoszeń, historia zmian',
    sourceRequirement: '4.1.2',
    requiresProtocol: false,
    isActive: true,
  },
  {
    code: 'ATK-25',
    title: 'Niezwłoczna rejestracja wady wykrytej przez Wykonawcę',
    description: 'Jeżeli wada zostanie wykryta po stronie Wykonawcy, należy niezwłocznie poinformować Zamawiającego i zarejestrować zgłoszenie.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 1,
    relativeUnit: 'calendar_days',
    triggerLabel: 'wykrycie wady przez wykonawcę',
    owner: 'Lider utrzymania',
    evidenceHint: 'Zgłoszenie w portalu, klasyfikacja wady, potwierdzenie komunikacji',
    sourceRequirement: '4.1.2',
    requiresProtocol: false,
    isActive: true,
  },
  {
    code: 'ATK-46',
    title: 'Dostarczenie dokumentacji i kodów do 10 dni roboczych po zakończeniu sprawy',
    description: 'Po zakończeniu obsługi wady, aktualizacji lub konsultacji należy dostarczyć komplet materiałów w terminie 10 dni roboczych.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 10,
    relativeUnit: 'business_days',
    triggerLabel: 'zamknięcie zgłoszenia / konsultacji / aktualizacji',
    owner: 'PM / lider techniczny',
    evidenceHint: 'Paczka źródeł, dokumentacja z trybem śledzenia zmian, potwierdzenie przekazania',
    sourceRequirement: '4.1.2',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-47',
    title: 'Usunięcie niespójności dokumentacji do 4 dni roboczych',
    description: 'Po otrzymaniu informacji o niespójności dokumentacji trzeba poprawić ją w terminie 4 dni roboczych.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 4,
    relativeUnit: 'business_days',
    triggerLabel: 'zgłoszenie niespójności dokumentacji',
    owner: 'Analityk / PM',
    evidenceHint: 'Wskazanie różnic, poprawiona dokumentacja, potwierdzenie odbioru',
    sourceRequirement: '4.1.2',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-48',
    title: 'Comiesięczny raport ATiK',
    description: 'Co miesiąc należy przygotować raport zgodny z aktualnym wzorem protokołu odbioru usług.',
    kind: 'recurring',
    scheduleType: 'monthly',
    anchorDate: format(new Date(), 'yyyy-MM-01'),
    owner: 'PM',
    evidenceHint: 'Raport miesięczny, protokół odbioru, zestawienie prac',
    sourceRequirement: '4.1.2',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-56',
    title: 'Instrukcja dla przypadku szczególnego po konsultacji',
    description: 'Przypadki szczególne wymagają przygotowania i udostępnienia instrukcji rozwiązania.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 5,
    relativeUnit: 'business_days',
    triggerLabel: 'zamknięcie konsultacji przypadku szczególnego',
    owner: 'Konsultant / PM',
    evidenceHint: 'Instrukcja, odpowiedź w portalu, potwierdzenie udostępnienia',
    sourceRequirement: '4.1.3',
    requiresProtocol: false,
    isActive: true,
  },
  {
    code: 'ATK-60',
    title: 'Plan wdrożenia i aktualizacja środowisk',
    description: 'Każda aktualizacja systemu powinna mieć uzgodniony plan wdrożenia, testy, instalacje i aktualizację dokumentacji.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 5,
    relativeUnit: 'business_days',
    triggerLabel: 'decyzja o wdrożeniu aktualizacji',
    owner: 'Release manager / PM',
    evidenceHint: 'Plan wdrożenia, testy, numer wersji, aktualizacja dokumentacji',
    sourceRequirement: '4.1.4',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-61.8',
    title: 'Półroczny przegląd kopii zapasowych',
    description: 'Raz na 6 miesięcy należy testowo odtworzyć system z kopii zapasowych na środowisko wskazane przez Zamawiającego.',
    kind: 'recurring',
    scheduleType: 'semiannual',
    anchorDate: format(new Date(), 'yyyy-MM-01'),
    owner: 'Administrator baz danych / infrastruktura',
    evidenceHint: 'Protokół odtworzenia, wynik testu, uwagi po odtworzeniu',
    sourceRequirement: '4.1.5',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-62-A',
    title: 'Weryfikacja monitoringu po przekazaniu dostępu',
    description: 'W ciągu 10 dni roboczych od przekazania dostępu należy zweryfikować konfigurację i działanie narzędzia monitoringu.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 10,
    relativeUnit: 'business_days',
    triggerLabel: 'przekazanie dostępu do monitoringu',
    owner: 'Administrator monitoringu',
    evidenceHint: 'Raport z weryfikacji, lista agentów, rekomendacje',
    sourceRequirement: '4.1.5',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-62-B',
    title: 'Utworzenie projektu monitoringu systemu',
    description: 'W ciągu 20 dni roboczych od przekazania dostępu należy uruchomić dedykowany projekt monitoringu dla systemu.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 20,
    relativeUnit: 'business_days',
    triggerLabel: 'przekazanie dostępu do monitoringu',
    owner: 'Administrator monitoringu',
    evidenceHint: 'Raport z wykonanych prac, konfiguracja projektu, lista parametrów',
    sourceRequirement: '4.1.5',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-63',
    title: 'Parametry polityk archiwizacji do 20 dni roboczych',
    description: 'Po przekazaniu dostępu należy określić parametry konfiguracji archiwizacji, RPO i RTO w terminie 20 dni roboczych.',
    kind: 'event',
    scheduleType: 'relative',
    relativeValue: 20,
    relativeUnit: 'business_days',
    triggerLabel: 'przekazanie dostępu do systemu',
    owner: 'Architekt / administrator',
    evidenceHint: 'Parametry archiwizacji, RPO/RTO, potwierdzenie poprawności',
    sourceRequirement: '4.1.5',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-64',
    title: 'Kwartalna weryfikacja zadań archiwizacyjnych',
    description: 'Nie rzadziej niż raz na kwartał lub po zmianie konfiguracji należy zweryfikować poprawność zadań archiwizacyjnych.',
    kind: 'recurring',
    scheduleType: 'quarterly',
    anchorDate: format(new Date(), 'yyyy-MM-01'),
    owner: 'Administrator backupu',
    evidenceHint: 'Protokół odbioru, uwagi, potwierdzenie usunięcia przyczyn uwag',
    sourceRequirement: '4.1.5',
    requiresProtocol: true,
    isActive: true,
  },
  {
    code: 'ATK-65',
    title: 'Półroczne testy disaster recovery',
    description: 'Nie rzadziej niż raz na 6 miesięcy lub po zmianie polityk archiwizacji należy przeprowadzić testy odzyskiwania systemu.',
    kind: 'recurring',
    scheduleType: 'semiannual',
    anchorDate: format(new Date(), 'yyyy-MM-01'),
    owner: 'Architekt / infrastruktura',
    evidenceHint: 'Scenariusz DR, protokół testów, lista uwag i poprawek',
    sourceRequirement: '4.1.5',
    requiresProtocol: true,
    isActive: true,
  },
];

const ServiceObligationModal = ({
  isOpen,
  obligation,
  onClose,
  onSave,
  onDelete,
}: {
  isOpen: boolean;
  obligation: ServiceObligation | null;
  onClose: () => void;
  onSave: (obligation: ServiceObligation) => Promise<void>;
  onDelete: (obligationId: string) => Promise<void>;
}) => {
  const [formData, setFormData] = useState<ServiceObligation | null>(obligation);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const recurringScheduleOptions: ServiceScheduleType[] = ['fixed_date', 'monthly', 'quarterly', 'semiannual', 'annual'];
  const eventScheduleOptions: ServiceScheduleType[] = ['fixed_date', 'relative'];

  useEffect(() => {
    setFormData(obligation);
    setError('');
    setIsSubmitting(false);
  }, [obligation]);

  if (!isOpen || !formData) return null;

  const handleChange = <K extends keyof ServiceObligation>(field: K, value: ServiceObligation[K]) => {
    setFormData((current) => {
      if (!current) return current;

      if (field === 'kind') {
        if (value === 'continuous') {
          return {
            ...current,
            kind: value,
            scheduleType: 'none',
            fixedDate: '',
            anchorDate: '',
            relativeValue: 0,
            relativeUnit: 'business_days',
            triggerLabel: '',
            updatedAt: createTimestamp(),
          };
        }

        if (value === 'recurring') {
          const nextScheduleType = recurringScheduleOptions.includes(current.scheduleType) ? current.scheduleType : 'monthly';
          return {
            ...current,
            kind: value,
            scheduleType: nextScheduleType,
            relativeValue: 0,
            relativeUnit: 'business_days',
            triggerLabel: '',
            updatedAt: createTimestamp(),
          };
        }

        if (value === 'event') {
          const nextScheduleType = eventScheduleOptions.includes(current.scheduleType) ? current.scheduleType : 'relative';
          return {
            ...current,
            kind: value,
            scheduleType: nextScheduleType,
            anchorDate: '',
            updatedAt: createTimestamp(),
          };
        }
      }

      return {
        ...current,
        [field]: value,
        updatedAt: createTimestamp(),
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.code.trim() || !formData.title.trim()) {
      setError('Kod i tytuł obowiązku są wymagane.');
      return;
    }

    if (formData.scheduleType === 'fixed_date' && !formData.fixedDate) {
      setError('Dla terminu jednorazowego wskaż datę.');
      return;
    }

    if (formData.scheduleType === 'relative' && !formData.relativeValue) {
      setError('Dla terminu zależnego od zdarzenia wskaż wartość terminu.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onSave(formData);
    } catch (saveError: any) {
      setError(saveError?.message || 'Nie udało się zapisać obowiązku.');
      setIsSubmitting(false);
    }
  };

  const showAnchorDate = ['monthly', 'quarterly', 'semiannual', 'annual'].includes(formData.scheduleType);
  const showFixedDate = formData.scheduleType === 'fixed_date';
  const showRelative = formData.scheduleType === 'relative';
  const scheduleOptions = formData.kind === 'continuous'
    ? [{ value: 'none', label: 'Brak terminu, monitoring ciągły' }]
    : formData.kind === 'event'
      ? [
          { value: 'fixed_date', label: 'Jedna konkretna data' },
          { value: 'relative', label: 'Licz od zdarzenia' },
        ]
      : [
          { value: 'fixed_date', label: 'Jedna konkretna data' },
          { value: 'monthly', label: 'Co miesiąc' },
          { value: 'quarterly', label: 'Co kwartał' },
          { value: 'semiannual', label: 'Co 6 miesięcy' },
          { value: 'annual', label: 'Co rok' },
        ];
  const scheduleHint = formData.kind === 'continuous'
    ? 'Obowiązek ciągły pozostaje bezterminowy i nie tworzy zadania do odhaczania.'
    : formData.kind === 'event'
      ? 'Dla obowiązku od zdarzenia możesz wskazać sztywną datę wykonania albo termin liczony od konkretnego zdarzenia.'
      : 'Dla obowiązku cyklicznego wybierz stałą datę albo rytm powtarzania wraz z datą bazową pierwszego cyklu.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Obowiązek umowny</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Skonfiguruj, co aplikacja ma pilnować i jak liczyć termin.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} />
          </button>
        </div>

        <form id="service-obligation-form" onSubmit={(event) => void handleSubmit(event)} className="overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Kod wymagania</label>
              <input
                value={formData.code}
                onChange={(event) => handleChange('code', event.target.value)}
                placeholder="np. ATK-12"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Właściciel / odpowiedzialny</label>
              <input
                value={formData.owner || ''}
                onChange={(event) => handleChange('owner', event.target.value)}
                placeholder="np. PM, DevOps, analityk"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tytuł obowiązku</label>
            <input
              value={formData.title}
              onChange={(event) => handleChange('title', event.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Opis operacyjny</label>
            <textarea
              value={formData.description}
              onChange={(event) => handleChange('description', event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30">
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Harmonogram</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{scheduleHint}</p>
            </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Typ obowiązku</label>
              <select
                value={formData.kind}
                onChange={(event) => handleChange('kind', event.target.value as ServiceObligation['kind'])}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              >
                <option value="continuous">Ciągły</option>
                <option value="recurring">Cykliczny</option>
                <option value="event">Od zdarzenia</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Sposób liczenia terminu</label>
              <select
                value={formData.scheduleType}
                onChange={(event) => handleChange('scheduleType', event.target.value as ServiceScheduleType)}
                disabled={formData.kind === 'continuous'}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              >
                {scheduleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.requiresProtocol}
                  onChange={(event) => handleChange('requiresProtocol', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
                Wymaga protokołu / formalnego potwierdzenia
              </label>
            </div>
          </div>
          </div>

          {formData.kind === 'continuous' && (
            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900/40 dark:bg-sky-500/10 dark:text-sky-200">
              Obowiązek ciągły nie tworzy zadania do odhaczenia. Jest widoczny w sekcji `Obowiązki ciągłe` i nie pojawia się na liście terminów do wykonania.
            </div>
          )}

          {showAnchorDate && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Data bazowa pierwszego cyklu</label>
              <input
                type="date"
                value={formData.anchorDate || ''}
                onChange={(event) => handleChange('anchorDate', event.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>
          )}

          {showFixedDate && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Termin wykonania</label>
              <input
                type="date"
                value={formData.fixedDate || ''}
                onChange={(event) => handleChange('fixedDate', event.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>
          )}

          {showRelative && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Po ilu jednostkach</label>
                <input
                  type="number"
                  min={1}
                  value={formData.relativeValue || 1}
                  onChange={(event) => handleChange('relativeValue', Number(event.target.value) || 1)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Jednostka</label>
                <select
                  value={formData.relativeUnit || 'business_days'}
                  onChange={(event) => handleChange('relativeUnit', event.target.value as ServiceRelativeUnit)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                >
                  <option value="hours">Godziny</option>
                  <option value="business_days">Dni robocze</option>
                  <option value="calendar_days">Dni kalendarzowe</option>
                  <option value="months">Miesiące</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Zdarzenie uruchamiające</label>
                <input
                  value={formData.triggerLabel || ''}
                  onChange={(event) => handleChange('triggerLabel', event.target.value)}
                  placeholder="np. zamknięcie zgłoszenia"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Dowód wykonania / artefakt</label>
              <input
                value={formData.evidenceHint || ''}
                onChange={(event) => handleChange('evidenceHint', event.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Źródło w umowie</label>
              <input
                value={formData.sourceRequirement || ''}
                onChange={(event) => handleChange('sourceRequirement', event.target.value)}
                placeholder="np. 4.1.5"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Notatki PM</label>
            <textarea
              value={formData.notes || ''}
              onChange={(event) => handleChange('notes', event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            />
          </div>
        </form>

        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 px-6 py-4">
          <div>
            {obligation && (
              <button
                type="button"
                onClick={() => void onDelete(obligation.id)}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20"
              >
                Usuń obowiązek
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
              Anuluj
            </button>
            <button
              type="submit"
              form="service-obligation-form"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ServiceEventModal = ({
  isOpen,
  event,
  obligations,
  onClose,
  onSave,
  onDelete,
}: {
  isOpen: boolean;
  event: ServiceEvent | null;
  obligations: ServiceObligation[];
  onClose: () => void;
  onSave: (event: ServiceEvent) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
}) => {
  const [formData, setFormData] = useState<ServiceEvent | null>(event);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFormData(event);
    setError('');
    setIsSubmitting(false);
  }, [event]);

  if (!isOpen || !formData) return null;

  const eventObligations = obligations.filter((item) => item.kind === 'event');

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!formData.title.trim()) {
      setError('Tytuł zdarzenia jest wymagany.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } catch (saveError: any) {
      setError(saveError?.message || 'Nie udało się zapisać zdarzenia.');
      setIsSubmitting(false);
    }
  };

  const handleChange = <K extends keyof ServiceEvent>(field: K, value: ServiceEvent[K]) => {
    setFormData((current) => current ? {
      ...current,
      [field]: value,
      updatedAt: createTimestamp(),
    } : current);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Zdarzenie uruchamiające termin</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Dodaj incydent, audyt lub wydanie poprawki, aby wygenerować zadania terminowe.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} />
          </button>
        </div>

        <form id="service-event-form" onSubmit={(submitEvent) => void handleSubmit(submitEvent)} className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Typ zdarzenia</label>
              <select
                value={formData.eventType}
                onChange={(event) => handleChange('eventType', event.target.value as ServiceEventType)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              >
                <option value="incident">Incydent / wada</option>
                <option value="security_patch">Poprawka bezpieczeństwa</option>
                <option value="audit">Audyt / zalecenie</option>
                <option value="consultation">Konsultacja</option>
                <option value="backup">Backup / archiwizacja</option>
                <option value="update">Aktualizacja</option>
                <option value="migration">Migracja</option>
                <option value="other">Inne</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Powiązany obowiązek</label>
              <select
                value={formData.obligationId || ''}
                onChange={(event) => handleChange('obligationId', event.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              >
                <option value="">Bez wskazania konkretnego obowiązku</option>
                {eventObligations.map((obligation) => (
                  <option key={obligation.id} value={obligation.id}>
                    {obligation.code} - {obligation.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tytuł zdarzenia</label>
            <input
              value={formData.title}
              onChange={(event) => handleChange('title', event.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Moment zdarzenia</label>
              <input
                type="datetime-local"
                value={formData.occurredAt.slice(0, 16)}
                onChange={(event) => handleChange('occurredAt', event.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Referencja</label>
              <input
                value={formData.reference || ''}
                onChange={(event) => handleChange('reference', event.target.value)}
                placeholder="np. numer zgłoszenia, wersja, link"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Notatki</label>
            <textarea
              value={formData.notes || ''}
              onChange={(event) => handleChange('notes', event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            />
          </div>
        </form>

        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 px-6 py-4">
          <div>
            {event && (
              <button
                type="button"
                onClick={() => void onDelete(event.id)}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20"
              >
                Usuń zdarzenie
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
              Anuluj
            </button>
            <button
              type="submit"
              form="service-event-form"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Zapisywanie...' : 'Zapisz zdarzenie'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ServiceView = ({ project, alerts = [] }: ServiceViewProps) => {
  const [state, setState] = useState<ServiceOverviewState>({ obligations: [], tasks: [], events: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingObligation, setEditingObligation] = useState<ServiceObligation | null>(null);
  const [editingEvent, setEditingEvent] = useState<ServiceEvent | null>(null);
  const [activeTaskFilter, setActiveTaskFilter] = useState<'all' | 'overdue' | 'upcoming' | 'completed'>('all');
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isTemplateActionPending, setIsTemplateActionPending] = useState(false);
  const [templateBaseDate, setTemplateBaseDate] = useState(project.dateFrom || new Date().toISOString().slice(0, 10));
  const [templateEndDate, setTemplateEndDate] = useState(project.dateTo || '');

  useEffect(() => {
    setTemplateBaseDate(project.dateFrom || new Date().toISOString().slice(0, 10));
    setTemplateEndDate(project.dateTo || '');
  }, [project.id, project.dateFrom, project.dateTo]);

  const loadData = async () => {
    if (!window.electron?.getServiceOverview) {
      setState({ obligations: [], tasks: [], events: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electron.getServiceOverview(project.id);
      setState({
        obligations: result.obligations || [],
        tasks: result.tasks || [],
        events: result.events || [],
      });
    } catch (loadError: any) {
      setError(loadError?.message || 'Nie udało się pobrać danych zakładki Obowiązki.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [project.id]);

  const overdueTasks = state.tasks.filter((task) => task.status === 'overdue');
  const pendingTasks = state.tasks.filter((task) => task.status === 'pending');
  const upcomingTasks = pendingTasks.filter((task) => {
    const dueDate = new Date(task.dueDate).getTime();
    if (!Number.isFinite(dueDate)) return false;
    const diff = dueDate - Date.now();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  });
  const completedTasks = state.tasks.filter((task) => task.status === 'completed');
  const continuousObligations = state.obligations.filter((item) => item.kind === 'continuous');
  const recentEvents = [...state.events].sort((first, second) => (second.occurredAt || '').localeCompare(first.occurredAt || '')).slice(0, 8);

  const filteredTasks = useMemo(() => {
    switch (activeTaskFilter) {
      case 'overdue':
        return overdueTasks;
      case 'upcoming':
        return upcomingTasks;
      case 'completed':
        return completedTasks;
      default:
        return state.tasks;
    }
  }, [activeTaskFilter, completedTasks, overdueTasks, state.tasks, upcomingTasks]);

  const obligationMap = useMemo(
    () => state.obligations.reduce<Record<string, ServiceObligation>>((acc, obligation) => {
      acc[obligation.id] = obligation;
      return acc;
    }, {}),
    [state.obligations],
  );

  const handleSaveObligation = async (obligation: ServiceObligation) => {
    if (!window.electron?.saveServiceObligation) return;
    await window.electron.saveServiceObligation({
      ...obligation,
      projectId: project.id,
      updatedAt: createTimestamp(),
    });
    setEditingObligation(null);
    await loadData();
  };

  const handleDeleteObligation = async (obligationId: string) => {
    if (!window.confirm('Czy usunąć obowiązek wraz z powiązanymi zadaniami i zdarzeniami?')) {
      return;
    }
    await window.electron?.deleteServiceObligation?.(obligationId);
    setEditingObligation(null);
    await loadData();
  };

  const handleSaveEvent = async (event: ServiceEvent) => {
    if (!window.electron?.saveServiceEvent) return;
    await window.electron.saveServiceEvent({
      ...event,
      projectId: project.id,
      updatedAt: createTimestamp(),
    });
    setEditingEvent(null);
    await loadData();
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Czy usunąć zdarzenie? Powiązane zadania pozostaną w historii.')) {
      return;
    }
    await window.electron?.deleteServiceEvent?.(eventId);
    setEditingEvent(null);
    await loadData();
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!window.electron?.completeServiceTask) return;
    setPendingTaskId(taskId);
    try {
      await window.electron.completeServiceTask(taskId);
      await loadData();
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleReopenTask = async (taskId: string) => {
    if (!window.electron?.reopenServiceTask) return;
    setPendingTaskId(taskId);
    try {
      await window.electron.reopenServiceTask(taskId);
      await loadData();
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleExportTemplate = async () => {
    if (!window.electron?.exportServiceObligationTemplate) return;
    setIsTemplateActionPending(true);
    setError(null);
    try {
      const result = await window.electron.exportServiceObligationTemplate({
        baseDate: templateBaseDate || project.dateFrom || new Date().toISOString().slice(0, 10),
        endDate: templateEndDate || project.dateTo || '',
      });
      if (!result?.canceled && result?.success) {
        window.alert(`Zapisano przykładowy plik JSON: ${result.filePath || 'bez wskazanej ścieżki'}`);
      }
    } catch (exportError: any) {
      setError(exportError?.message || 'Nie udało się wyeksportować przykładowego pliku JSON.');
    } finally {
      setIsTemplateActionPending(false);
    }
  };

  const handleImportTemplate = async () => {
    if (!window.electron?.readServiceObligationTemplate || !window.electron?.importServiceObligations) return;
    setIsTemplateActionPending(true);
    setError(null);
    try {
      const readResult = await window.electron.readServiceObligationTemplate();
      if (readResult?.canceled) {
        return;
      }

      const importedObligations = (readResult?.obligations || []).filter((item) => item?.title?.trim());
      if (importedObligations.length === 0) {
        setError('Wybrany plik JSON nie zawiera żadnych obowiązków do importu.');
        return;
      }

      let replaceExisting = false;
      if (state.obligations.length > 0) {
        replaceExisting = window.confirm(
          'W tym projekcie istnieją już obowiązki. Czy zastąpić obecną listę obowiązków listą z importowanego pliku JSON?',
        );
      }

      const result = await window.electron.importServiceObligations({
        projectId: project.id,
        replaceExisting,
        obligations: importedObligations,
      });

      setIsTemplateModalOpen(false);
      window.alert(`Zaimportowano ${result.importedCount} obowiązków${readResult?.fileName ? ` z pliku ${readResult.fileName}` : ''}.`);
      await loadData();
    } catch (importError: any) {
      setError(importError?.message || 'Nie udało się zaimportować obowiązków z pliku JSON.');
    } finally {
      setIsTemplateActionPending(false);
    }
  };

  const projectAlerts = alerts.filter((item) => item.projectId === project.id);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="relative overflow-hidden rounded-3xl border border-sky-100 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_42%),linear-gradient(135deg,_#ffffff_0%,_#f8fafc_55%,_#eff6ff_100%)] p-6 shadow-sm dark:border-sky-900/40 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(135deg,_rgba(17,24,39,0.96)_0%,_rgba(15,23,42,0.98)_60%,_rgba(3,105,161,0.28)_100%)]">
        <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-sm dark:bg-white/5 dark:text-sky-300">
              <ShieldCheck size={14} />
              Obowiązki projektu
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Kontrola obowiązków dla projektu {project.code}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                To miejsce porządkuje listę obowiązków dla projektu: wymagania ciągłe, terminy cykliczne oraz działania
                uruchamiane przez zdarzenia projektowe.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ProjectLinksDropdown project={project} visibleInTab="service" />
            <button
              type="button"
              onClick={() => setEditingEvent(createEmptyEvent(project.id, state.obligations))}
              className="rounded-2xl border border-gray-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Dodaj zdarzenie
            </button>
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/15"
            >
              Załaduj szablon
            </button>
            <button
              type="button"
              onClick={() => setEditingObligation(createEmptyObligation(project.id))}
              className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <span className="inline-flex items-center gap-2"><Plus size={15} /> Dodaj obowiązek</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {projectAlerts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900/40 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-amber-600 dark:text-amber-300" size={18} />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">Ostatnie alerty dla tego projektu</p>
              <div className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-100">
                {projectAlerts.slice(0, 3).map((alert) => (
                  <p key={alert.taskId}>
                    <span className="font-semibold">{alert.obligationCode || 'Obowiązek'}</span> - {alert.title} - termin {formatDateTime(alert.dueDate)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="pcc-card-compact border-red-100 dark:border-red-900/30">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Zaległe zadania</p>
          <p className="mt-3 text-3xl font-black text-red-600 dark:text-red-300">{overdueTasks.length}</p>
        </div>
        <div className="pcc-card-compact border-amber-100 dark:border-amber-900/30">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Nadchodzące 7 dni</p>
          <p className="mt-3 text-3xl font-black text-amber-600 dark:text-amber-300">{upcomingTasks.length}</p>
        </div>
        <div className="pcc-card-compact border-emerald-100 dark:border-emerald-900/30">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Wykonane</p>
          <p className="mt-3 text-3xl font-black text-emerald-600 dark:text-emerald-300">{completedTasks.length}</p>
        </div>
        <div className="pcc-card-compact border-sky-100 dark:border-sky-900/30">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Obowiązki ciągłe</p>
          <p className="mt-3 text-3xl font-black text-sky-600 dark:text-sky-300">{continuousObligations.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <div className="pcc-card-panel">
            <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-700 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Terminy do dopilnowania</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lista zadań wygenerowanych z harmonogramów i zdarzeń umownych.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Wszystkie' },
                  { id: 'overdue', label: 'Zaległe' },
                  { id: 'upcoming', label: 'Nadchodzące' },
                  { id: 'completed', label: 'Wykonane' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveTaskFilter(filter.id as typeof activeTaskFilter)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      activeTaskFilter === filter.id
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-indigo-500" size={28} />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                Brak zadań dla wybranego filtra. Dodaj obowiązek cykliczny albo zdarzenie, aby pojawiły się konkretne terminy.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-6 py-4">Obowiązek</th>
                      <th className="px-6 py-4">Termin</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Źródło</th>
                      <th className="px-6 py-4 text-center">Akcja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredTasks.map((task) => {
                      const obligation = obligationMap[task.obligationId];
                      const statusClass =
                        task.status === 'overdue'
                          ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40'
                          : task.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40';

                      return (
                        <tr key={task.id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {obligation?.code ? `${obligation.code} - ` : ''}{task.title}
                              </div>
                              {task.description && (
                                <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{task.description}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-200">{formatDateTime(task.dueDate)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                              {task.status === 'overdue' ? 'Po terminie' : task.status === 'completed' ? 'Wykonane' : 'Do wykonania'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                            {task.sourceType === 'event' ? 'Zdarzenie' : 'Harmonogram'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {task.status !== 'completed' ? (
                              <button
                                type="button"
                                disabled={pendingTaskId === task.id}
                                onClick={() => void handleCompleteTask(task.id)}
                                className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                              >
                                {pendingTaskId === task.id ? 'Zapisywanie...' : 'Oznacz jako wykonane'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={pendingTaskId === task.id}
                                onClick={() => void handleReopenTask(task.id)}
                                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                              >
                                Cofnij wykonanie
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pcc-card-panel">
            <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Katalog obowiązków</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">W tym miejscu opisujesz, co dokładnie musi być spełnione w ramach projektu.</p>
            </div>

            {isLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-indigo-500" size={28} />
              </div>
            ) : state.obligations.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                Brak obowiązków. Załaduj szablon albo dodaj pierwszy własny obowiązek ręcznie.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {state.obligations.map((obligation) => {
                  const scheduleDetails = getObligationScheduleDetails(obligation);

                  return (
                    <div key={obligation.id} className="px-6 py-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                              {obligation.code || 'Bez kodu'}
                            </span>
                            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                              {obligation.kind === 'continuous' ? 'Ciągły' : obligation.kind === 'event' ? 'Od zdarzenia' : 'Cykliczny'}
                            </span>
                            {!obligation.isActive && (
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                Nieaktywny
                              </span>
                            )}
                            {obligation.requiresProtocol && (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                                Protokół wymagany
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">{obligation.title}</h4>
                            <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{obligation.description}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                              <span className="block text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">Harmonogram</span>
                              <span className="mt-1 block text-xs font-semibold text-gray-900 dark:text-white">{scheduleDetails.schedule}</span>
                            </div>
                            <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
                              <span className="block text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-200">Ilość i jednostka</span>
                              <span className="mt-1 block text-xs font-semibold text-gray-900 dark:text-white">{scheduleDetails.amountUnit}</span>
                            </div>
                            <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 dark:border-sky-500/20 dark:bg-sky-500/10">
                              <span className="block text-[11px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-200">Wyzwalacz</span>
                              <span className="mt-1 block text-xs font-semibold text-gray-900 dark:text-white">{scheduleDetails.trigger}</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Pełny opis harmonogramu:</span> {getScheduleLabel(obligation)}
                          </p>
                          <div className="grid grid-cols-1 gap-2 text-xs text-gray-500 dark:text-gray-400 md:grid-cols-2">
                            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Właściciel:</span> {obligation.owner || 'Nie wskazano'}</p>
                            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Źródło:</span> {obligation.sourceRequirement || 'Brak'}</p>
                          </div>
                          {obligation.evidenceHint && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Dowód wykonania:</span> {obligation.evidenceHint}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingObligation(obligation)}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            <Edit2 size={15} />
                            Edytuj
                          </button>
                        </div>
                        </div>
                      </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="pcc-card-compact">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-indigo-500" size={18} />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Obowiązki ciągłe</h3>
            </div>
            <div className="mt-4 space-y-3">
              {continuousObligations.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Brak obowiązków ciągłych.</p>
              ) : (
                continuousObligations.map((obligation) => (
                  <div key={obligation.id} className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 dark:border-sky-900/30 dark:bg-sky-500/10">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{obligation.code} - {obligation.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{obligation.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pcc-card-compact">
            <div className="flex items-center gap-2">
              <Siren className="text-indigo-500" size={18} />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Zdarzenia i wyzwalacze</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Tutaj wpisujesz realne zdarzenia z projektu: incydenty, wydania poprawek, audyty, przekazanie dostępów czy konsultacje.
              To one uruchamiają liczenie terminów dla wymagań względnych.
            </p>

            <div className="mt-4 space-y-3">
              {recentEvents.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Brak zarejestrowanych zdarzeń. Dodaj pierwsze zdarzenie, aby aplikacja mogła wyliczyć terminy zależne od sytuacji w projekcie.
                </p>
              ) : (
                recentEvents.map((event) => {
                  const linkedObligation = event.obligationId ? obligationMap[event.obligationId] : null;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setEditingEvent(event)}
                      className="w-full rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/70 dark:border-gray-700 dark:bg-gray-900/30 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{event.title}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{getEventTypeLabel(event.eventType)} • {formatDateTime(event.occurredAt)}</p>
                          {linkedObligation && (
                            <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">{linkedObligation.code} - {linkedObligation.title}</p>
                          )}
                        </div>
                        <Edit2 size={14} className="text-gray-400" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="pcc-card-compact">
            <div className="flex items-center gap-2">
              <Clock3 className="text-indigo-500" size={18} />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Jak z tego korzystać</h3>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
              <p>1. Wyeksportuj przykładowy szablon JSON, przygotuj listę obowiązków w zewnętrznym narzędziu i zaimportuj gotowy plik.</p>
              <p>2. Dla obowiązków cyklicznych ustaw datę bazową pierwszego cyklu, np. od startu projektu lub od pierwszego przeglądu.</p>
              <p>3. Dla obowiązków zależnych od sytuacji wpisuj zdarzenia: incydent, wydanie poprawki, przekazanie dostępów, audyt.</p>
              <p>4. Zakładka sama pokaże, co jest po terminie, co nadchodzi i co zostało już potwierdzone jako wykonane.</p>
              <p>5. W dowodzie wykonania wpisz artefakt, którego PM powinien pilnować: protokół, commit, raport, potwierdzenie w portalu.</p>
            </div>
          </div>

        </div>
      </div>

      <TemplateManagerModal
        isOpen={isTemplateModalOpen}
        isBusy={isTemplateActionPending}
        sampleCount={Math.min(DEFAULT_ATK_OBLIGATIONS.length, 3)}
        baseDate={templateBaseDate}
        endDate={templateEndDate}
        onBaseDateChange={setTemplateBaseDate}
        onEndDateChange={setTemplateEndDate}
        onClose={() => setIsTemplateModalOpen(false)}
        onExport={handleExportTemplate}
        onImport={handleImportTemplate}
      />

      <ServiceObligationModal
        isOpen={Boolean(editingObligation)}
        obligation={editingObligation}
        onClose={() => setEditingObligation(null)}
        onSave={handleSaveObligation}
        onDelete={handleDeleteObligation}
      />

      <ServiceEventModal
        isOpen={Boolean(editingEvent)}
        event={editingEvent}
        obligations={state.obligations}
        onClose={() => setEditingEvent(null)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
};
