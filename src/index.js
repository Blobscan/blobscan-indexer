const axios = require("axios");
const ethers = require("ethers");
const { connectToDatabase } = require("./mongodb");
const {
  calculateVersionedHash,
  getEIP4844Tx,
  getBlobTx,
  generateCollectionData,
} = require("./utils");

const EXECUTION_NODE_RPC =
  process.env.EXECUTION_NODE_URL || "http://localhost:8545";
const BEACON_NODE_RPC = process.env.BEACON_NODE_RPC || "http://localhost:3500";

const provider = new ethers.providers.StaticJsonRpcProvider(EXECUTION_NODE_RPC);

async function main() {
  let currentSlot = 0;

  const { db } = await connectToDatabase();

  while (true) {
    const latestBlock = (
      await axios.get(`${BEACON_NODE_RPC}/eth/v2/beacon/blocks/head`)
    ).data.data;
    const headSlot = parseInt(latestBlock.message.slot, 10);
    console.log(`Head slot ${headSlot}, current slot ${currentSlot}`);

    while (currentSlot < headSlot) {
      currentSlot++;

      try {
        console.log(`Reading slot ${currentSlot}`);

        const beaconBlock = (
          await axios.get(
            `${BEACON_NODE_RPC}/eth/v2/beacon/blocks/${currentSlot}`
          )
        ).data.data;

        if (!beaconBlock.message.body.execution_payload) {
          continue;
        }

        const beaconExecutionBlockHash =
          beaconBlock.message.body.execution_payload.block_hash;
        const currentExecutionBlock = await provider.getBlock(
          beaconExecutionBlockHash
        );

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

          const sidecar = (
            await axios.get(
              `${BEACON_NODE_RPC}/eth/v1/blobs/sidecar/${currentSlot}`
            )
          ).data.data;

          if (!sidecar.length) {
            console.log(`No blobs data found on sidecar at ${currentSlot}`);
          } else {
            console.log(`Found ${sidecar.length} at slot ${currentSlot}`);

            let insertFns = [];

            const blockDocument = {
              ...currentExecutionBlock,
              slot: currentSlot,
            };

            insertFns.push(generateCollectionData(db, "blocks", blockDocument));

            blobTxs.forEach((tx, index) => {
              const txDocument = {
                ...tx,
                index,
                block: currentExecutionBlock.number,
              };

              insertFns.push(generateCollectionData(db, "txs", txDocument));
            });

            sidecar.blobs.forEach((blob, index) => {
              const commitment = beaconBlock.message.body.blob_kzgs[index];
              const versionedHash = calculateVersionedHash(commitment);
              const tx = getBlobTx(blobTxs, versionedHash);

              const blobDocument = {
                hash: versionedHash,
                commitment,
                data: blob,
                tx: tx.hash,
                index,
              };

              insertFns.push(generateCollectionData(db, "blobs", blobDocument));
            });

            console.log(
              `Inserting ${insertFns.length} documents for slot ${currentSlot}`
            );
            await Promise.all(insertFns);
          }
        }
      } catch (err) {
        console.log(err);
      }
    }

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    await delay(1000);
  }
}

main();
