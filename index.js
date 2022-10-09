const axios = require("axios")
const { JsonRpcProviderWithFinalizedEvents } = require("./src/provider");
const { connectToDatabase } = require("./src/mongodb");
const { getEIP4844Tx } = require("./src/utils");

const provider = new JsonRpcProviderWithFinalizedEvents("http://localhost:8545")

async function main() {

    let latestFinalizedSlot = 1

    provider.on("finalized", async (blockNumber) => {
        const currentExecutionBlock = await provider.getBlock(blockNumber)

        const blobTxs = (await Promise.all(
            currentExecutionBlock.transactions.map(txHash => getEIP4844Tx(provider, txHash)))).filter(
                tx => tx.blobVersionedHashes.length
            )

        if (blobTxs.length) {
            const currentSlot =
                (await axios.get("http://localhost:3500/eth/v1/beacon/headers")).data
                    .data[0].header.message.slot;

            let matchBeaconBlock
            let i = currentSlot
            while (i > latestFinalizedSlot) {

                const beaconBlock = (
                    await axios.get(
                        `http://localhost:3500/eth/v2/beacon/blocks/${i}`
                    )
                ).data.data;

                const beaconExecutionBlockHash = beaconBlock.message.body.execution_payload.block_hash

                if (beaconExecutionBlockHash === currentExecutionBlock.hash) {
                    matchBeaconBlock = beaconBlock
                    break
                }

                i--
            }

            latestFinalizedSlot = currentSlot

            const sidecarData = (
                await axios.get(
                    `http://localhost:3500/eth/v1/blobs/sidecar/${i}`
                )
            ).data.data;

            // confirm blobTxs === kekack256(blob_kzgs)
            // store all data in databse
        }

    });
}

main()