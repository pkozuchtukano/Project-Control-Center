import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import tippy, { type Instance } from 'tippy.js';
import { MentionList, type MentionListHandle } from './MentionList';

export type MentionStakeholder = { id: string, name: string };
export type MentionSuggestionItem = MentionStakeholder & { label: string };

type MentionSuggestionProps = SuggestionProps<MentionSuggestionItem>;

export const formatMentionLabel = (stakeholder: MentionStakeholder) => {
  const name = stakeholder.name.trim();

  return name ? `P. ${name}` : 'P.';
};

export const getSuggestionParams = (stakeholders: MentionStakeholder[]) => {
  return {
    items: ({ query }: { query: string }) => {
      const normalizedQuery = query.toLowerCase();

      return stakeholders
        .map(item => ({
          ...item,
          label: formatMentionLabel(item),
        }))
        .filter(item => (
          item.name.toLowerCase().includes(normalizedQuery)
          || item.label.toLowerCase().includes(normalizedQuery)
        ))
        .slice(0, 5);
    },

    render: () => {
      let component: ReactRenderer<MentionListHandle>;
      let popup: Instance[];

      return {
        onStart: (props: MentionSuggestionProps) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          popup = tippy('body', {
            getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },

        onUpdate(props: MentionSuggestionProps) {
          component.updateProps(props);

          if (!props.clientRect) {
            return;
          }

          popup[0].setProps({
            getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          });
        },

        onKeyDown(props: SuggestionKeyDownProps) {
          if (props.event.key === 'Escape') {
            popup[0].hide();
            return true;
          }

          return component.ref?.onKeyDown({ event: props.event }) ?? false;
        },

        onExit() {
          if (popup && popup.length > 0) {
            popup[0].destroy();
          }
          if (component) {
            component.destroy();
          }
        },
      };
    },
  };
};
