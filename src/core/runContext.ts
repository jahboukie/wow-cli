let currentRunId: string | undefined;

export function setRunId(id: string) {
  currentRunId = id;
}

export function getRunId(): string | undefined {
  return currentRunId;
}

export function newRunId(): string {
  const rand = Math.random().toString(36).slice(2, 6);
  const id = `${Date.now()}-${rand}`;
  currentRunId = id;
  return id;
}
