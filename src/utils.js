function getEIP4844Tx(provider, hash) {
    return provider.send("eth_getTransactionByHash", [hash])
}

module.exports = {
    getEIP4844Tx
}

