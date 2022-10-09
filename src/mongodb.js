const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

function connectToDatabase() {
    const opts = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    };

    MongoClient.connect(MONGODB_URI, opts).then((client) => {
        return {
            client,
            db: client.db(MONGODB_DB),
        };
    });
}

module.exports = {
    connectToDatabase
}