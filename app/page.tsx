import Chat from '@/components/Chat';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex flex-col">
        <h1 className="text-4xl font-bold mb-8">Mi-agente-QodeIA</h1>
        <p className="mb-8 text-center text-gray-600">
          Agente autónomo con gobernanza PageRank dinámica y memoria híbrida.
        </p>
        <Chat />
      </div>
    </main>
  );
}
