use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&std::env::var("DATABASE_URL")?)
        .await?;
    sqlx::migrate!().run(&pool).await?;
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("API listening on :3000");
    axum::serve(listener, tbm_vouchers::app(pool))
        .with_graceful_shutdown(async {
            #[cfg(unix)]
            {
                let mut term =
                    tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                        .expect("SIGTERM handler");
                tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = term.recv() => {} }
            }
            #[cfg(not(unix))]
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
