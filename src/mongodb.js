const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

async function connectToDatabase() {
    const opts = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    };

    const client = await MongoClient.connect(MONGODB_URI, opts)

    return {
        client,
        db: client.db(MONGODB_DB)
    }
}

module.exports = {
    connectToDatabase
}