const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');

(async () => {
  const mongod = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbPath: path.join(__dirname, 'mongodb-data'),
      storageEngine: 'wiredTiger',
    },
  });
  const uri = mongod.getUri();
  console.log('LOCAL_MONGO_READY ' + uri);

  process.on('SIGINT', async () => { await mongod.stop(); process.exit(0); });
  process.on('SIGTERM', async () => { await mongod.stop(); process.exit(0); });
})().catch((err) => {
  console.error('LOCAL_MONGO_FAILED', err);
  process.exit(1);
});
