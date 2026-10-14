import 'server-only';
import {db, type DbClient} from '@/platform/database';
import {getTagRefreshMonitorService} from '@/modules/tag/server';
import {PostgresDbBrowserService} from './services/db-browser/postgres';
import {AdminApplicationServiceImpl} from './services/admin/AdminApplicationServiceImpl';
import {AdminOHSAdapterImpl} from './services/admin/AdminOHSAdapterImpl';
import {RecycleBinApplicationServiceImpl} from './services/recycle-bin/RecycleBinApplicationServiceImpl';
import {RecycleBinOHSAdapterImpl} from './services/recycle-bin/RecycleBinOHSAdapterImpl';

const databaseBrowser = new PostgresDbBrowserService(db);
export function getDbBrowserService(client: DbClient = db): PostgresDbBrowserService {
  return client === db ? databaseBrowser : new PostgresDbBrowserService(client);
}
export const adminOHSAdapter = new AdminOHSAdapterImpl();
export const adminApplicationService = new AdminApplicationServiceImpl(
  databaseBrowser, adminOHSAdapter, () => getTagRefreshMonitorService().checkAllRefreshStatus(),
);
export const recycleBinApplicationService = new RecycleBinApplicationServiceImpl();
export const recycleBinOHSAdapter = new RecycleBinOHSAdapterImpl();
