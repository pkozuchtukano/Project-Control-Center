import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Edit2, ExternalLink, Loader2, Plus, Trash2, X } from 'lucide-react';
import type { Project, ProjectLink } from '../../../types';

interface ProjectLinksMainProps {
  project: Project;
  compact?: boolean;
}

interface ProjectLinksDropdownProps {
  project: Project;
}

interface LinkModalProps {
  isOpen: boolean;
  projectId: string;
  linkToEdit: ProjectLink | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (link: ProjectLink) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const createLinkId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `project_link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const validateUrl = (value: string) => {
  try {
    const parsed = new URL(normalizeUrl(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const LinkModal = ({ isOpen, projectId, linkToEdit, isSaving, onClose, onSave, onDelete }: LinkModalProps) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(linkToEdit?.name ?? '');
    setUrl(linkToEdit?.url ?? '');
    setError('');
  }, [isOpen, linkToEdit]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const normalizedUrl = normalizeUrl(url);

    if (!trimmedName) {
      setError('Podaj nazwę linku.');
      return;
    }

    if (!validateUrl(normalizedUrl)) {
      setError('Podaj poprawny adres URL.');
      return;
    }

    const timestamp = new Date().toISOString();

    await onSave({
      id: linkToEdit?.id ?? createLinkId(),
      projectId,
      name: trimmedName,
      url: normalizedUrl,
      createdAt: linkToEdit?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  };

  const handleDelete = async () => {
    if (!linkToEdit) {
      return;
    }

    if (!confirm(`Czy na pewno chcesz usunąć link "${linkToEdit.name}"?`)) {
      return;
    }

    await onDelete(linkToEdit.id);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {linkToEdit ? 'Edytuj link' : 'Nowy link'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Zapisz nazwę i adres, który ma się otwierać po kliknięciu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
              Nazwa
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
              placeholder="np. Środowisko testowe"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
              placeholder="https://example.com"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
            <div>
              {linkToEdit && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={16} />
                  Usuń
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                Zapisz
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

const useProjectLinksState = (projectId: string) => {
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ProjectLink | null>(null);

  const sortedLinks = useMemo(
    () =>
      [...links].sort((first, second) => {
        const byName = first.name.localeCompare(second.name, 'pl', { sensitivity: 'base' });
        if (byName !== 0) {
          return byName;
        }

        return first.createdAt.localeCompare(second.createdAt);
      }),
    [links]
  );

  const loadLinks = async () => {
    setIsLoading(true);
    try {
      if (window.electron?.getProjectLinks) {
        const savedLinks = await window.electron.getProjectLinks(projectId);
        setLinks(savedLinks || []);
      } else {
        setLinks([]);
      }
    } catch (error) {
      console.error('Project links load failed:', error);
      setLinks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLinks();
  }, [projectId]);

  const handleOpenCreate = () => {
    setEditingLink(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (link: ProjectLink) => {
    setEditingLink(link);
    setIsModalOpen(true);
  };

  const handleOpenExternal = async (url: string) => {
    try {
      await window.electron?.openExternal(url);
    } catch (error) {
      console.error('Open external link failed:', error);
    }
  };

  const handleSave = async (link: ProjectLink) => {
    setIsSaving(true);
    try {
      await window.electron?.saveProjectLink(link);
      await loadLinks();
      setIsModalOpen(false);
      setEditingLink(null);
    } catch (error) {
      console.error('Project link save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    try {
      await window.electron?.deleteProjectLink(id);
      await loadLinks();
      setIsModalOpen(false);
      setEditingLink(null);
    } catch (error) {
      console.error('Project link delete failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    sortedLinks,
    isLoading,
    isSaving,
    isModalOpen,
    editingLink,
    handleOpenCreate,
    handleOpenEdit,
    handleOpenExternal,
    handleSave,
    handleDelete,
    setIsModalOpen,
    setEditingLink,
  };
};

export const ProjectLinksDropdown = ({ project }: ProjectLinksDropdownProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    sortedLinks,
    isLoading,
    isSaving,
    isModalOpen,
    editingLink,
    handleOpenCreate,
    handleOpenEdit,
    handleOpenExternal,
    handleSave,
    handleDelete,
    setIsModalOpen,
    setEditingLink,
  } = useProjectLinksState(project.id);

  useEffect(() => {
    if (isModalOpen) {
      setIsExpanded(false);
    }
  }, [isModalOpen]);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
          aria-expanded={isExpanded}
          aria-haspopup="true"
        >
          <span>Linki</span>
          {sortedLinks.length > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
              {sortedLinks.length}
            </span>
          )}
          <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isExpanded && (
          <div className="absolute right-0 top-full z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">Linki projektu</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{project.code}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  handleOpenCreate();
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"
              >
                <Plus size={14} />
                Dodaj
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              ) : sortedLinks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                  Brak zapisanych linków dla tego projektu.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/30"
                    >
                      <button
                        type="button"
                        onClick={() => void handleOpenExternal(link.url)}
                        className="group min-w-0 flex-1 text-left"
                        title={link.url}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 transition group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                          <span className="truncate">{link.name}</span>
                          <ExternalLink size={13} className="shrink-0 opacity-60" />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsExpanded(false);
                          handleOpenEdit(link);
                        }}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-white hover:text-indigo-600 dark:hover:bg-gray-800 dark:hover:text-indigo-300"
                        title="Edytuj link"
                        aria-label={`Edytuj link ${link.name}`}
                      >
                        <Edit2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <LinkModal
        isOpen={isModalOpen}
        projectId={project.id}
        linkToEdit={editingLink}
        isSaving={isSaving}
        onClose={() => {
          if (!isSaving) {
            setIsModalOpen(false);
            setEditingLink(null);
          }
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  );
};

export const ProjectLinksMain = ({ project, compact = false }: ProjectLinksMainProps) => {
  const {
    sortedLinks,
    isLoading,
    isSaving,
    isModalOpen,
    editingLink,
    handleOpenCreate,
    handleOpenEdit,
    handleOpenExternal,
    handleSave,
    handleDelete,
    setIsModalOpen,
    setEditingLink,
  } = useProjectLinksState(project.id);

  return (
    <div className={`rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-800 ${compact ? 'h-full flex flex-col' : ''}`}>
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Linki</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Lista skrótów dla projektu {project.code}. Kliknięcie nazwy otwiera adres w przeglądarce.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"
          title="Dodaj link"
          aria-label="Dodaj link"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className={`p-6 ${compact ? 'flex-1 min-h-0 overflow-y-auto' : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : sortedLinks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
            Brak zapisanych linków dla tego projektu. Użyj ikony plus, aby dodać pierwszy wpis.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedLinks.map((link) => (
              <button
                type="button"
                key={link.id}
                onClick={() => void handleOpenExternal(link.url)}
                className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-gray-700 dark:bg-gray-900/30 dark:hover:border-indigo-800 dark:hover:bg-indigo-900/10"
                title={link.url}
              >
                <div className="min-w-0">
                  <div className="flex max-w-full items-center gap-2 text-base font-semibold text-gray-900 transition group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                    <span className="truncate">{link.name}</span>
                    <ExternalLink size={14} className="shrink-0 opacity-60" />
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenEdit(link);
                    }}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-white hover:text-indigo-600 dark:hover:bg-gray-800 dark:hover:text-indigo-300"
                    title="Edytuj link"
                    aria-label={`Edytuj link ${link.name}`}
                  >
                    <Edit2 size={15} />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <LinkModal
        isOpen={isModalOpen}
        projectId={project.id}
        linkToEdit={editingLink}
        isSaving={isSaving}
        onClose={() => {
          if (!isSaving) {
            setIsModalOpen(false);
            setEditingLink(null);
          }
        }}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
};
