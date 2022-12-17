use ethers::{prelude::*, providers};

pub async fn get_eip_4844_tx(
    provider: &Provider<Http>,
    hash: H256,
) -> Result<Transaction, providers::ProviderError> {
    provider
        .request::<Vec<H256>, Transaction>("eth_getTransactionByHash", vec![hash])
        .await
}
