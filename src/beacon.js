const axios = require("axios");

const BEACON_NODE_RPC = process.env.BEACON_NODE_RPC || "http://localhost:3500";

async function getLatestSlot() {
    const latestBlock = (
      await axios.get(`${BEACON_NODE_RPC}/eth/v2/beacon/blocks/head`)
    ).data.data;
    const latestSlot = parseInt(latestBlock.message.slot, 10);
    return latestSlot;
  }
  
  async function getSidecar(slot) {
    const sidecar = (
      await axios.get(
        `${BEACON_NODE_RPC}/eth/v1/beacon/blobs_sidecars/${slot}`
      )
    ).data.data;
    return sidecar;
  }
  
  async function getBeaconBlock(slot) {
    const block = (
      await axios.get(`${BEACON_NODE_RPC}/eth/v2/beacon/blocks/${slot}`)
    ).data.data;
    return block;
  }


  function getCommitments(beaconBlock, index) {
    return beaconBlock.message.body.blob_kzg_commitments[index];
  }
  
  function getExecutionPayload(beaconBlock) {
    return beaconBlock.message.body.execution_payload;
  }
  
  async function getExecutionBlock(provider, beaconBlock) {
    const beaconExecutionBlockHash =
      beaconBlock.message.body.execution_payload.block_hash;
    return provider.getBlock(
      beaconExecutionBlockHash
    );
  }

  module.exports = {
    getLatestSlot,
    getSidecar,
    getBeaconBlock,
    getCommitments,
    getExecutionPayload,
    getExecutionBlock,
  };