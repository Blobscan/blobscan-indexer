const ethers = require("ethers");
const {
  calculateVersionedHash,
  getEIP4844Tx,
  getBlobTx,
} = require("./utils");
const {
  getLatestSlot,
  getSidecar,
  getBeaconBlock,
  getCommitments,
  getExecutionPayload,
  getExecutionBlock,
} = require("./beacon");
const { BlobDB } = require("./BlobDB");

const EXECUTION_NODE_RPC =
  process.env.EXECUTION_NODE_URL || "http://localhost:8545";

const provider = new ethers.providers.StaticJsonRpcProvider(EXECUTION_NODE_RPC);

async function main() {
  let currentSlot = 0;

  const blobDB = await BlobDB.connect();

  while (true) {
    const headSlot = await getLatestSlot();
    
    console.log(`Head slot ${headSlot}, current slot ${currentSlot}`);

    while (currentSlot < headSlot) {
      currentSlot++;

      try {
        console.log(`Reading slot ${currentSlot}`);

        let currentBeaconBlock;
        try {
          currentBeaconBlock = getBeaconBlock(currentSlot);
        } catch (e) {
          console.log(`No block found at slot ${currentSlot}`);
          continue;
        }

        if (!getExecutionPayload(currentBeaconBlock)) {
          continue;
        }

        const currentExecutionBlock = await getExecutionBlock(provider, currentBeaconBlock);

        const blobTxs = (
          await Promise.all(
            currentExecutionBlock.transactions.map((txHash) =>
              getEIP4844Tx(provider, txHash)
            )
          )
        ).filter(
          (tx) => tx.blobVersionedHashes && tx.blobVersionedHashes.length
        );

        if (!blobTxs.length) {
          console.log(`No blobs hashes found at slot ${currentSlot}`);
        } else {
          console.log(`Found ${blobTxs.length} at slot ${currentSlot}`);

          const sidecar = await getSidecar(currentSlot);

          if (!sidecar || !sidecar.blobs.length) {
            console.log(`No blobs data found on sidecar at ${currentSlot}`);
          } else {
            console.log(`Found ${sidecar.blobs.length} at slot ${currentSlot}`);

            blobDB.insertBlock(currentExecutionBlock, currentSlot)

            blobTxs.forEach((tx, index) => {
              blobDB.insertTx(tx, index, currentExecutionBlock.number)
            });

            sidecar.blobs.forEach((blob, index) => {
              const commitment = getCommitments(currentBeaconBlock, index);
              const versionedHash = calculateVersionedHash(commitment);
              const tx = getBlobTx(blobTxs, versionedHash);

              blobDB.insertBlob(blob, tx, index);
            });

            console.log(
              `Inserting ${blobDB.unsaved()} documents for slot ${currentSlot}`
            );
            await blobDB.save();
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    await Promise.delay(1000);
  }
}

main();
