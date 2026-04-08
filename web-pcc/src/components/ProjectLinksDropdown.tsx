import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Edit2, ExternalLink, Loader2, Plus, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { Project, ProjectLink } from '@/types/domain';
import { createClientId, cn } from '@/lib/utils';
import { pccRepository } from '@/repositories/pccRepository';

const tabOptions = [
  { id: 'status', label: 'Status' },
  { id: 'notes', label: 'Notatki' },
  { id: 'daily', label: 'Daily' },
] as const;

const normalizeUrl = (value: string) => (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value.trim()) ? value.trim() : `https://${value.trim()}`);

const LinkModal = ({ isOpen, projectId, linkToEdit, defaultVisibleInTabs, onClose, onSaved }: { isOpen: boolean; projectId: string; linkToEdit: ProjectLink | null; defaultVisibleInTabs: string[]; onClose: () => void; onSaved: () => void }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [visibleInTabs, setVisibleInTabs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(linkToEdit?.name || '');
    setUrl(linkToEdit?.url || '');
    setVisibleInTabs(linkToEdit?.visibleInTabs || defaultVisibleInTabs);
  }, [defaultVisibleInTabs, isOpen, linkToEdit]);

  if (!isOpen) return null;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    const timestamp = new Date().toISOString();
    await pccRepository.saveProjectLink({
      id: linkToEdit?.id || createClientId('project_link'),
      projectId,
      name: name.trim(),
      url: normalizeUrl(url),
      visibleInTabs,
      createdAt: linkToEdit?.createdAt || timestamp,
      updatedAt: timestamp,
    });
    setIsSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!linkToEdit) return;
    setIsSaving(true);
    await pccRepository.deleteProjectLink(linkToEdit.id);
    setIsSaving(false);
    onSaved();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{linkToEdit ? 'Edytuj link' : 'Nowy link'}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Zapisz nazwę i adres, który ma się otwierać po kliknięciu.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"><X size={18} /></button>
        </div>
        <form className="space-y-5 p-6" onSubmit={handleSave}>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Nazwa</label>
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-gray-400">URL</label>
            <input value={url} onChange={(event) => setUrl(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Widoczne dodatkowo w zakładkach</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tabOptions.map((tab) => {
                const checked = visibleInTabs.includes(tab.id);
                return (
                  <label key={tab.id} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm', checked ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200' : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300')}>
                    <input type="checkbox" checked={checked} onChange={() => setVisibleInTabs((current) => current.includes(tab.id) ? current.filter((item) => item !== tab.id) : [...current, tab.id])} />
                    <span>{tab.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700">
            <div>
              {linkToEdit && <button type="button" onClick={handleDelete} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"><Trash2 size={16} />Usuń</button>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">Anuluj</button>
              <button type="submit" disabled={isSaving || !name.trim() || !url.trim()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{isSaving && <Loader2 size={16} className="animate-spin" />}Zapisz</button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export const ProjectLinksDropdown = ({ project, visibleInTab = 'status' }: { project: Project; visibleInTab?: string }) => {
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ProjectLink | null>(null);

  const loadLinks = async () => {
    setIsLoading(true);
    setLinks(await pccRepository.getProjectLinks(project.id));
    setIsLoading(false);
  };

  useEffect(() => { void loadLinks(); }, [project.id]);

  const filtered = useMemo(() => links.filter((item) => item.visibleInTabs.includes(visibleInTab)).sort((a, b) => a.name.localeCompare(b.name, 'pl')), [links, visibleInTab]);

  return (
    <>
      <div className="relative">
        <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
          <span>Linki</span>
          {filtered.length > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">{filtered.length}</span>}
          <ChevronDown size={16} className={cn('transition-transform', isOpen && 'rotate-180')} />
        </button>
        {isOpen && (
          <div className="absolute right-0 top-full z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">Linki projektu</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{project.code}</div>
              </div>
              <button type="button" onClick={() => { setEditingLink(null); setIsModalOpen(true); setIsOpen(false); }} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"><Plus size={14} />Dodaj</button>
            </div>
            <div className="max-h-80 overflow-y-auto p-3">
              {isLoading ? <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 size={18} className="animate-spin" /></div> : filtered.length === 0 ? <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">Brak zapisanych linków dla tej zakładki.</div> : <div className="space-y-2">{filtered.map((link) => <div key={link.id} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/30"><a href={link.url} target="_blank" rel="noreferrer" className="group min-w-0 flex-1 text-left"><div className="flex items-center gap-2 text-sm font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300"><span className="truncate">{link.name}</span><ExternalLink size={13} className="shrink-0 opacity-60" /></div></a><button type="button" onClick={() => { setEditingLink(link); setIsModalOpen(true); setIsOpen(false); }} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-indigo-600 dark:hover:bg-gray-800 dark:hover:text-indigo-300"><Edit2 size={15} /></button></div>)}</div>}
            </div>
          </div>
        )}
      </div>
      <LinkModal isOpen={isModalOpen} projectId={project.id} linkToEdit={editingLink} defaultVisibleInTabs={[visibleInTab]} onClose={() => setIsModalOpen(false)} onSaved={() => { setIsModalOpen(false); void loadLinks(); }} />
    </>
  );
};

