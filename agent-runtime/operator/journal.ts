import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

export class Journal {
  readonly directory: string;
  constructor(directory: string) { this.directory = directory; }
  async initialize() { await mkdir(this.directory, { recursive: true, mode: 0o700 }); }
  async read<T>(name: string, fallback: T): Promise<T> {
    try { return JSON.parse(await readFile(path.join(this.directory, name + ".json"), "utf8")) as T; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
  }
  async write(name: string, value: unknown) {
    const file = path.join(this.directory, name + ".json");
    const temporary = file + ".tmp";
    const handle = await open(temporary, "w", 0o600);
    try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, file);
    const directory = await open(this.directory, "r");
    try { await directory.sync(); } finally { await directory.close(); }
  }
  async exclusive<T>(name: string, action: () => Promise<T>): Promise<T> {
    const file = path.join(this.directory, name + ".lock");
    const handle = await open(file, "wx", 0o600).catch(() => { throw new Error("Operator is busy or has an unreconciled process lock. Inspect the journal before retrying."); });
    try { return await action(); } finally { await handle.close(); await unlink(file); }
  }
}
