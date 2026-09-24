import { z } from 'zod';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(2).max(50),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Проверьте поля: email, пароль от 8 до 72 символов, имя от 2 до 50 символов.' },
      { status: 400 },
    );
  }

  const { email, password, name } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'Email уже зарегистрирован' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.user.create({
      data: { email: normalizedEmail, name: name.trim(), passwordHash, role: 'USER' },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
