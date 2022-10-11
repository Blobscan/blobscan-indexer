const axios = require("axios")
const { JsonRpcProviderWithFinalizedEvents } = require("./src/provider");
const { connectToDatabase } = require("./src/mongodb");
const { calculateVersionedHash, getEIP4844Tx, getBlobTx, generateCollectionData } = require("./src/utils");

const EXECUTION_NODE_RPC = process.env.EXECUTION_NODE_URL || "http://localhost:8545"
const BEACON_NODE_RPC = process.env.BEACON_NODE_RPC || "http://localhost:3500"

const provider = new JsonRpcProviderWithFinalizedEvents(EXECUTION_NODE_RPC)

async function main() {

    let latestFinalizedSlot = 1

    const { db } = await connectToDatabase()

    provider.on("finalized", async (blockNumber) => {
        const currentExecutionBlock = await provider.getBlock(blockNumber)

        const blobTxs = (await Promise.all(
            currentExecutionBlock.transactions.map(txHash => getEIP4844Tx(provider, txHash)))).filter(
                tx => tx.blobVersionedHashes && tx.blobVersionedHashes.length
            )

        if (blobTxs.length) {
            const headerSlot =
                (await axios.get(`${BEACON_NODE_RPC}/eth/v1/beacon/headers`)).data
                    .data[0].header.message.slot;

            let matchBeaconBlock
            let currentSlot = headerSlot
            while (currentSlot > latestFinalizedSlot) {

                const beaconBlock = (
                    await axios.get(
                        `${BEACON_NODE_RPC}/eth/v2/beacon/blocks/${currentSlot}`
                    )
                ).data.data;

                const beaconExecutionBlockHash = beaconBlock.message.body.execution_payload.block_hash

                if (beaconExecutionBlockHash === currentExecutionBlock.hash) {
                    matchBeaconBlock = beaconBlock
                    break
                }

                currentSlot--
            }
            latestFinalizedSlot = headerSlot

            const sidecar = (
                await axios.get(
                    `${BEACON_NODE_RPC}/eth/v1/blobs/sidecar/${currentSlot}`
                )
            ).data.data;

            let insertFns = []

            const blockDocument = {
                number: currentExecutionBlock.number,
                hash: currentExecutionBlock.hash,
                timestamp: currentExecutionBlock.timestamp,
                slot: currentSlot
            }

            insertFns.push(generateCollectionData(db, "blocks", blockDocument))

            blobTxs.forEach((tx, index) => {
                const txDocument = {
                    hash: tx.hash,
                    block: currentExecutionBlock.number,
                    from: tx.from,
                    to: tx.to,
                    index
                }

                insertFns.push(generateCollectionData(db, "txs", txDocument))
            })

            sidecar.blobs.forEach((blob, index) => {
                const commitment = matchBeaconBlock.message.body.blob_kzgs[index]
                const versionedHash = calculateVersionedHash(commitment)
                const tx = getBlobTx(blobTxs, versionedHash)

                const blobDocument = {
                    hash: versionedHash,
                    commitment,
                    data: blob,
                    tx: tx.hash,
                    index
                }

                insertFns.push(generateCollectionData(db, "blobs", blobDocument))
            })

            await Promise.all(insertFns)
        }
    });
}

main()