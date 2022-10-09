const ethers = require("ethers");

class JsonRpcProviderWithFinalizedEvents extends ethers.providers.JsonRpcProvider {
    async on(eventName, callback) {
        if (eventName === "finalized") {
            let pendingBlocks = new Set()

            super.on("block", async (blockNumber) => {
                pendingBlocks.add(blockNumber)

                const final = await super.getBlock("finalized")

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

module.exports = {
    JsonRpcProviderWithFinalizedEvents
}
