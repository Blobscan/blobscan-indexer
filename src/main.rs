use crate::mongodb::connect_to_database;

mod mongodb;

type StdErr = Box<dyn std::error::Error>;


#[tokio::main]
async fn main() -> Result<(), StdErr> {
    dotenv::dotenv()?;

    let db = connect_to_database().await?;

    Ok(())
}
