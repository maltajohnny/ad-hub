/**
 * Leitura em runtime de variáveis de ambiente nas funções `/api`.
 * Na Vercel, `process.env.NOME` estático por vezes é inlined no bundle no deploy com valor
 * vazio se a variável não estiver disponível nessa fase; chaves dinâmicas evitam isso.
 * @see https://vercel.com/docs/projects/environment-variables
 */
export function getServerEnv(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}
