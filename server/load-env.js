// Native dotenv loading, before importing any server/provider modules.
// https://nodejs.org/api/process.html#processloadenvfilepath (checked 2026-11-09)
import { loadEnvFile } from 'node:process';

try {
  loadEnvFile(new URL('../.env', import.meta.url));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
