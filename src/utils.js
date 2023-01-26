const { utils } = require("ethers")

const BLOB_COMMITMENT_VERSION_KZG = "0x01"

function getEIP4844Tx(provider, hash) {
    return provider.send("eth_getTransactionByHash", [hash])
}

function calculateVersionedHash(commitment) {
    return BLOB_COMMITMENT_VERSION_KZG + utils.sha256(commitment).slice(4)
}

function getBlobTx(blobTxs, versionedHash) {
    return blobTxs.find(tx => {
        return tx.blobVersionedHashes.includes(versionedHash)
    })
}

function generateCollectionData(db, name, document) {
    const collection = db.collection(name)

    return collection.insertOne(document)
}

module.exports = {
    calculateVersionedHash,
    getEIP4844Tx,
    getBlobTx,
    generateCollectionData
}

