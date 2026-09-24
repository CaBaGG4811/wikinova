'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setNote('Форма-заглушка не отправляет письма. Напишите на redakciya@wikinova.local.');
  }

  return (
    <form onSubmit={onSubmit} className="card mt-6 max-w-[68ch] space-y-4 p-6">
      <h2 className="font-display text-h3 font-semibold">Написать редакции</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Имя</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
      </div>
      <label className="block">
        <span className="label">Сообщение</span>
        <textarea
          className="input min-h-[7rem] resize-y"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-secondary">
          Отправить
        </button>
        {note ? <p className="text-caption text-muted">{note}</p> : null}
      </div>
    </form>
  );
}
