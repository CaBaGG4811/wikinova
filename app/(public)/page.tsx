import type { Metadata } from 'next';
import { AssistantHome } from '@/components/assistant/AssistantHome';
import { AutoAuth } from '@/components/home/AutoAuth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ассистент',
  description:
    'ГАЛИЛЕО — ассистент энциклопедии: задайте вопрос и получите ответ из статей локальной энциклопедии.',
};

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { auth?: string; from?: string; q?: string };
}) {
  const question =
    typeof searchParams?.q === 'string' && searchParams.q.trim() ? searchParams.q.trim() : undefined;

  return (
    <>
      <AutoAuth mode={searchParams?.auth} />
      <AssistantHome initialQuestion={question} />
    </>
  );
}
