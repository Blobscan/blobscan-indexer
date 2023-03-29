const { connectToDatabase } = require("./mongodb");
const { generateCollectionData } = require("./utils");

class BlobDB {
    constructor() {
      this.insertFns = [];
    }
  
    static async connect() {
      const blobDB = new BlobDB();
      const { db } = await connectToDatabase();
      blobDB.db = db;
      return blobDB;
    }
  
    insertBlock(executionBlock, slot) {
      const blockDocument = {
        ...executionBlock,
        _id: executionBlock.hash,
        slot,
      };
    
      this.insertFns.push(generateCollectionData(this.db, "blocks", blockDocument));
    }
  
    insertBlob(blob, tx, index) {
      const blobDocument = {
        _id: `${tx.hash}-${index}`,
        hash: versionedHash,
        commitment,
        data: blob,
        tx: tx.hash,
        index,
      };
  
      this.insertFns.push(generateCollectionData(this.db, "blobs", blobDocument));
    }
  
    insertTx(tx, index, executionBlockNumber) {
      const txDocument = {
        ...tx,
        _id: tx.hash,
        index,
        block: executionBlockNumber,
      };
  
      this.insertFns.push(generateCollectionData(this.db, "txs", txDocument));
    }
  
    unsaved() {
      return this.insertFns.length;
    }
  
    async save() {
      await Promise.all(this.insertFns);
      this.insertFns = [];
    }
  }

  module.exports = {
    BlobDB,
  }