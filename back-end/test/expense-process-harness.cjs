const path = require('node:path');
const backend = path.resolve(__dirname, '..');
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require(path.join(backend, 'dist/src/app.module'));
const { configureHttpApplication } = require(
  path.join(backend, 'dist/src/common/config/configure-http-application'),
);
const { EmployeeImportService } = require(
  path.join(backend, 'dist/src/tenant/configuration/employee-import.service'),
);
(async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureHttpApplication(app);
  await app.listen(0, '127.0.0.1');
  await app.get(EmployeeImportService).onModuleDestroy();
  process.send({ port: app.getHttpServer().address().port });
  process.on('message', async (message) => {
    if (message === 'stop') {
      app.getHttpServer().closeIdleConnections?.();
      await app.close();
      process.exit(0);
    }
  });
})().catch(() => {
  process.exit(1);
});
