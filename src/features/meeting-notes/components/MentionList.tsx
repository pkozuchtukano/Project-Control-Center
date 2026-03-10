import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.name });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg flex flex-col p-1 overflow-hidden z-50 relative min-w-[150px]">
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
          <button
            className={`text-left px-3 py-1.5 text-sm rounded-lg ${
              index === selectedIndex 
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            {item.name}
          </button>
        ))
      ) : (
        <div className="px-3 py-1.5 text-sm text-gray-400 text-center">Brak wyników</div>
      )}
    </div>
  );
});

MentionList.displayName = 'MentionList';
