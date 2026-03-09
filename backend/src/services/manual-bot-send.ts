/**
 * Armazena resultados de envios do bot manual em background.
 * Usado para evitar timeout 502 quando há muitos leads.
 */
type JobData =
  | { status: "processing"; userId: string }
  | { status: "completed"; userId: string; sent: number; blocked: number; errors: number; total: number }
  | { status: "error"; userId: string; error: string };

const sendResults = new Map<string, JobData>();

export function setSendJob(jobId: string, userId: string) {
  sendResults.set(jobId, { status: "processing", userId });
  setTimeout(() => sendResults.delete(jobId), 30 * 60 * 1000);
}

export function setSendResult(
  jobId: string,
  userId: string,
  result: { sent: number; blocked: number; errors: number; total: number }
) {
  sendResults.set(jobId, { status: "completed", userId, ...result });
}

export function setSendError(jobId: string, userId: string, error: string) {
  sendResults.set(jobId, { status: "error", userId, error });
}

export function getSendResult(jobId: string, userId: string) {
  const data = sendResults.get(jobId);
  if (!data || data.userId !== userId) return null;
  return data;
}
