require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB Atlas');

    // Drop legacy indexes that no longer exist in the schema
    try {
      const userCollection = mongoose.connection.collection('users');
      const indexes = await userCollection.indexes();
      const hasUsernameIndex = indexes.some((i) => i.name === 'username_1');
      if (hasUsernameIndex) {
        await userCollection.dropIndex('username_1');
        console.log('Dropped legacy username_1 index');
      }
    } catch (e) {
      // Index may not exist — safe to ignore
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});
