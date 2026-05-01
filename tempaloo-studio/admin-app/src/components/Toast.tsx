import { useEffect, useState } from 'react';

interface ToastMessage {
  id:   number;
  text: string;
  type: 'info' | 'error';
}

let counter = 0;
const subs: Array<(m: ToastMessage) => void> = [];

export const toast = {
  info:  (text: string) => subs.forEach((fn) => fn({ id: ++counter, text, type: 'info' })),
  error: (text: string) => subs.forEach((fn) => fn({ id: ++counter, text, type: 'error' })),
};

export function ToastHost() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const fn = (m: ToastMessage) => {
      setItems((arr) => [...arr, m]);
      window.setTimeout(() => setItems((arr) => arr.filter((x) => x.id !== m.id)), 3500);
    };
    subs.push(fn);
    return () => { subs.splice(subs.indexOf(fn), 1); };
  }, []);

  return (
    <>
      {items.map((m) => (
        <div key={m.id} className={'tsa-toast' + (m.type === 'error' ? ' tsa-toast--error' : '')}>
          {m.text}
        </div>
      ))}
    </>
  );
}
