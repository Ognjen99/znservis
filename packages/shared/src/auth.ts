export const WORKER_AUTH_EMAIL_DOMAIN = "worker.znservis.local";

export function normalizeWorkerLoginName(name: string) {
  return name.trim().toLowerCase();
}

export function workerAuthEmailLocalPart(loginName: string) {
  const normalized = normalizeWorkerLoginName(loginName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  if (!normalized.length) {
    throw new Error("Ime radnika nije validno.");
  }

  return normalized;
}

export function workerAuthEmail(loginName: string) {
  return `${workerAuthEmailLocalPart(loginName)}@${WORKER_AUTH_EMAIL_DOMAIN}`;
}
