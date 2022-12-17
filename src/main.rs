use crate::mongodb::connect_to_database;
use blob_indexer::get_eip_4844_tx;
use ethers::prelude::*;
use futures::future::join_all;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::{env, error, str::FromStr, thread, time::Duration};

mod mongodb;

type StdErr = Box<dyn error::Error>;

#[derive(Serialize, Deserialize, Debug)]
struct ExecutionPayload {
    block_hash: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct MessageBody {
    execution_payload: Option<ExecutionPayload>,
}
#[derive(Serialize, Deserialize, Debug)]
struct Message {
    slot: String,
    body: MessageBody,
}

#[derive(Serialize, Deserialize, Debug)]
struct Data {
    message: Message,
}

#[derive(Serialize, Deserialize, Debug)]
struct BeaconAPIResponse {
    version: String,
    execution_optimistic: bool,
    data: Data,
}

#[tokio::main]
async fn main() -> Result<(), StdErr> {
    dotenv::dotenv()?;

    let execution_node_rpc = env::var("EXECUTION_NODE_RPC")?;
    let beacon_node_rpc = env::var("BEACON_NODE_RPC")?;

    let provider = Provider::<Http>::try_from(execution_node_rpc)?;
    let db = connect_to_database().await?;

    let mut current_slot = 0;

    loop {
        let latest_beacon_block =
            reqwest::get(format!("{}/eth/v2/beacon/blocks/head", beacon_node_rpc))
                .await?
                .json::<BeaconAPIResponse>()
                .await?;
        let head_slot: u32 = latest_beacon_block.data.message.slot.parse()?;

        while current_slot < head_slot {
            current_slot = current_slot + 1;

            println!("Reading slot {current_slot} (head slot {head_slot})");

            let beacon_block_response = reqwest::get(format!(
                "{}/eth/v2/beacon/blocks/{}",
                beacon_node_rpc, current_slot
            ))
            .await?;

            // TODO: handle rest of the response cases. What to do?
            if beacon_block_response.status() != StatusCode::OK {
                println!("Skipping slot as there is no beacon block");
                current_slot = current_slot + 1;

                continue;
            }

            let beacon_block = beacon_block_response.json::<BeaconAPIResponse>().await?;
            let execution_payload = beacon_block.data.message.body.execution_payload;

            if execution_payload.is_none() {
                println!("Skipping slot as there is no execution payload");
                continue;
            }

            let execution_block_hash = execution_payload.unwrap().block_hash;

            let execution_block_hash = H256::from_str(execution_block_hash.as_str())?;
            let execution_block = provider.get_block(execution_block_hash).await?.unwrap();

            let execution_block_txs = join_all(
                execution_block
                    .transactions
                    .into_iter()
                    .map(|tx_hash| get_eip_4844_tx(&provider, tx_hash)),
            )
            .await;
            let execution_block_txs = execution_block_txs
                .into_iter()
                .map(|tx| tx.unwrap())
                .collect::<Vec<Transaction>>();
            let blob_txs = execution_block_txs
                .into_iter()
                .filter(|tx| tx.other.contains_key("blobVersionedHashes"))
                .collect::<Vec<Transaction>>();

            if blob_txs.len() == 0 {
                println!("Skipping slot as there is no blob tx in execution block");
                continue;
            }

            println!("Execution block {execution_block_hash} read");
        }

        thread::sleep(Duration::from_secs(1));
    }
}
