# Blobscan indexer <a href="#"><img align="right" src=".github/assets/blobi.jpeg" height="80px" /></a>

Indexer for [Blobscan](https://github.com/Blobscan/blobscan) blockchain explorer that allows navigating the data of the [EIP-4844](https://www.eip4844.com) blobs.

## How it works?

The indexer crawl the blockchain fetching information from both the Execution and Beacon clients. The data is processed and stored in a MongoDB database.

## How to run it?

Two environment variables are necessary to connect to the MongoDB database. Write the following lines in a new `.env` file:

```
MONGODB_URI=mongodb+srv://<user>:<pass>@<host>/?retryWrites=true&w=majority
MONGODB_DB=<db-name>
```

Aditionally, the indexer needs to know the URL of both clients. If none is configured the defaults URL are assumed: `http://localhost:8545` for the Execution client and `http://localhost:3500` for the Beacon client.

To configure a custom URL write the following lines in a new `.env` file:

```
EXECUTION_NODE_RPC_URL=<execution-node-rpc-url>
BEACON_NODE_RPC=<beacon-node-rpc-url>
```

If you prefer to use docker we have created an image for the indexer at [blossomlabs/blobscan-indexer](https://hub.docker.com/repository/docker/blossomlabs/blobscan-indexer/general).

### Docker

A docker image is also provided which can be run as:

```
docker run -e MONGODB_URI=mongodb://blobscan:secret@mongo:27017 -e MONGODB_DB=blobscan blossomlabs/blobscan-indexer:master
```

# About Blossom Labs
![blossom labs](https://blossom.software/img/logo.svg)

Blobscan is being developed by [Blossom Labs](https://blossom.software/), a developer team specialized in building blockchain-based infrastructure for online communities.
