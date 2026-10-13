const path = require('node:path');
const backend = path.resolve(__dirname, '..');
require(path.join(backend, 'node_modules/dotenv')).config({
  path: path.join(backend, '.env'),
  quiet: true,
});
require(path.join(backend, 'node_modules/reflect-metadata'));
const { NestFactory } = require(
  path.join(backend, 'node_modules/@nestjs/core'),
);
const { AppModule } = require(path.join(backend, 'dist/src/app.module'));
const { configureHttpApplication } = require(
  path.join(backend, 'dist/src/common/config/configure-http-application'),
);
(async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.use(require(path.join(backend, 'node_modules/cookie-parser'))());
  configureHttpApplication(app);
  await app.listen(3301, '127.0.0.1');
  process.send('ready');
  process.on('message', async (message) => {
    if (message === 'stop') {
      // Browser keep-alive sockets must not hold a disposable restart open.
      // Active requests still drain through Nest's normal shutdown lifecycle.
      app.getHttpServer().closeIdleConnections?.();
      await app.close();
      process.exit(0);
    }
  });
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
