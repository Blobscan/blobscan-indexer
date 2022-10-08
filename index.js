const axios = require("axios")
const ethers = require("ethers")

class JsonRpcProviderWithFinalizedEvents extends ethers.providers.JsonRpcProvider {
    async on(eventName, callback) {
        if (eventName === "finalized") {
            let pendingBlocks = new Set()

            super.on("block", async (blockNumber) => {
                pendingBlocks.add(blockNumber)

                const final = await super.getBlock("finalized")

                console.log("final", final.number)
                console.log("pendingBlocks", pendingBlocks)

                let pendingFinalized = final.number
                while (pendingBlocks.has(pendingFinalized)) {
                    super.emit("finalized", pendingFinalized)
                    callback(pendingFinalized)
                    pendingBlocks.delete(pendingFinalized)
                    pendingFinalized--
                }
            });
        } else {
            super.on(eventName, calback)
        }


    }
}

async function main() {

    let latestFinalizedSlot = 1

    const provider = new JsonRpcProviderWithFinalizedEvents("http://localhost:8545")

    function getEIP4844Tx(hash) {
        return provider.send("eth_getTransactionByHash", [hash])
    }

    provider.on("finalized", async (blockNumber) => {
        const currentExecutionBlock = await provider.getBlock(blockNumber)

        const blobTxs = (await Promise.all(
            currentExecutionBlock.transactions.map(txHash => getEIP4844Tx(txHash)))).filter(
                tx => tx.blobVersionedHashes.length
            )

        if (blobTxs.length) {
            const currentSlot =
                (await axios.get("http://localhost:3500/eth/v1/beacon/headers")).data
                    .data[0].header.message.slot - 1;

            let matchBeaconBlock
            let i = currentSlot
            while (!matchBeaconBlock && i > latestFinalizedSlot) {

                const beaconBlock = (
                    await axios.get(
                        `http://localhost:3500/eth/v2/beacon/blocks/${i}`
                    )
                ).data.data;

                const beaconExecutionBlockHash = beaconBlock.message.body.execution_payload.block_hash

                if (beaconExecutionBlockHash === currentExecutionBlock.hash) {
                    matchBeaconBlock = beaconBlock
                }
                i--
            }

            latestFinalizedSlot = currentSlot

            const sidecarData = await axios.get(
                `http://localhost:8080?slot=${i}`
            )

            console.log(matchBeaconBlock)
            console.log(sidecarData)




            // confirm blobTxs === kekack256(blob_kzgs)

            // store all data in databse
        }

    });
}

main()