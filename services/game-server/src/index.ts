import { createApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/database';
import { Repository } from './db/repository';
import { log } from './logger';

const config = loadConfig();
const db = openDatabase(config.DATABASE_PATH);
const app = createApp(config, new Repository(db));

app.server.listen(config.PORT, config.HOST, () => {
  log('info', 'server.listening', { port: config.PORT, origins: config.WEB_ORIGINS });
});

const shutdown = (signal: string) => {
  log('info', 'server.shutdown', { signal });
  void app.close().then(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
