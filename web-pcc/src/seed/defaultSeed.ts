import type { Project, DailyHub, DailySection } from '@/types/domain';

export const defaultSeed: {
  projects: Project[];
  dailyHubs: DailyHub[];
  dailySections: DailySection[];
} = {
  projects: [
    { id: 'seed-pms', code: 'PMS', name: 'Programy masowe', youtrackQuery: 'PMS' },
    { id: 'seed-cbcp', code: 'CBCP', name: 'Centralna Baza Czyste Powietrze', youtrackQuery: 'CBCP' },
    { id: 'seed-pfron', code: 'PFRON', name: 'Pañstwowy Fundusz Rehabilitacji Osób Niepe³nosprawnych', youtrackQuery: 'PFRON' },
    { id: 'seed-gwd', code: 'GWD', name: 'GWD', youtrackQuery: 'GWD' },
    { id: 'seed-sop', code: 'SOP', name: 'Narodowe Centrum Kultury', youtrackQuery: 'SOP' }
  ],
  dailyHubs: [
    { id: 'hub-pfron', name: 'PFRON', description: '', projectCodes: 'PFRON' },
    { id: 'hub-pcc', name: 'PMS, GWD, CBCP', description: '', projectCodes: 'PMS, GWD, CBCP' }
  ],
  dailySections: [
    { id: 'section-planowane', hubId: 'hub-pcc', name: 'Planowane', youtrackStatuses: 'To Do', orderIndex: 0, respectDates: false },
    { id: 'section-wtrakcie', hubId: 'hub-pcc', name: 'W takcie', youtrackStatuses: 'In Progress, Code Review', orderIndex: 1, respectDates: false },
    { id: 'section-testy', hubId: 'hub-pcc', name: 'Testy', youtrackStatuses: 'Tests', orderIndex: 2, respectDates: false }
  ]
};
