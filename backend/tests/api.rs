use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

async fn request(
    app: Router,
    method: &str,
    path: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let response = app
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header("content-type", "application/json")
                .body(Body::from(body.map(|b| b.to_string()).unwrap_or_default()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}
#[sqlx::test(migrations = "./migrations")]
async fn activation_decrements_balance_and_records_history(pool: PgPool) {
    let app = tbm_vouchers::app(pool);
    let (status, activation) =
        request(app.clone(), "POST", "/api/users/1/activations/1", None).await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(activation["product_name"], "Stage 1");
    assert!(activation["activated_at"].as_str().is_some());
    let (_, balances) = request(app.clone(), "GET", "/api/users/1/balances", None).await;
    assert_eq!(balances[0]["quantity"], 4);
    let (_, history) = request(app, "GET", "/api/users/1/activations", None).await;
    assert_eq!(history["total"], 1);
    assert_eq!(history["items"][0]["id"], activation["id"]);
}
#[sqlx::test(migrations = "./migrations")]
async fn zero_and_missing_balances_cannot_activate(pool: PgPool) {
    let app = tbm_vouchers::app(pool);
    for path in ["/api/users/1/activations/3", "/api/users/2/activations/2"] {
        let (status, body) = request(app.clone(), "POST", path, None).await;
        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(body["code"], "no_vouchers");
    }
    let (_, history) = request(app, "GET", "/api/users/1/activations", None).await;
    assert_eq!(history["total"], 0);
}
#[sqlx::test(migrations = "./migrations")]
async fn admin_replaces_and_upserts_with_validation(pool: PgPool) {
    let app = tbm_vouchers::app(pool);
    for quantity in [7, 2, 0, 1_000_000] {
        let (status, body) = request(
            app.clone(),
            "PUT",
            "/api/users/2/balances/2",
            Some(json!({"quantity": quantity})),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["quantity"], quantity);
    }
    for body in [
        json!({"quantity": -1}),
        json!({"quantity": 1_000_001}),
        json!({"quantity": 1.5}),
        json!({"quantity": "2"}),
        json!({}),
        json!({"quantity": 2, "extra":true}),
    ] {
        let (status, _) = request(app.clone(), "PUT", "/api/users/2/balances/2", Some(body)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }
}
#[sqlx::test(migrations = "./migrations")]
async fn unknown_entities_return_not_found(pool: PgPool) {
    let app = tbm_vouchers::app(pool);
    for (method, path, body) in [
        ("GET", "/api/users/999/balances", None),
        ("GET", "/api/users/999/activations", None),
        ("POST", "/api/users/1/activations/999", None),
        ("POST", "/api/users/999/activations/1", None),
        (
            "PUT",
            "/api/users/1/balances/999",
            Some(json!({"quantity": 1})),
        ),
        (
            "PUT",
            "/api/users/999/balances/1",
            Some(json!({"quantity": 1})),
        ),
    ] {
        assert_eq!(
            request(app.clone(), method, path, body).await.0,
            StatusCode::NOT_FOUND
        );
    }
}
#[sqlx::test(migrations = "./migrations")]
async fn concurrent_requests_cannot_spend_last_voucher_twice(pool: PgPool) {
    let app = tbm_vouchers::app(pool.clone());
    request(
        app.clone(),
        "PUT",
        "/api/users/1/balances/1",
        Some(json!({"quantity": 1})),
    )
    .await;
    let mut tasks = tokio::task::JoinSet::new();
    for _ in 0..20 {
        let app = app.clone();
        tasks.spawn(async move {
            request(app, "POST", "/api/users/1/activations/1", None)
                .await
                .0
        });
    }
    let mut successful = 0;
    while let Some(result) = tasks.join_next().await {
        match result.unwrap() {
            StatusCode::CREATED => successful += 1,
            StatusCode::CONFLICT => {}
            other => panic!("unexpected status: {other}"),
        }
    }
    assert_eq!(successful, 1);
    assert_eq!(
        sqlx::query_scalar::<_, i32>(
            "SELECT quantity FROM voucher_balances WHERE user_id=1 AND product_id=1"
        )
        .fetch_one(&pool)
        .await
        .unwrap(),
        0
    );
    let (_, history) = request(app, "GET", "/api/users/1/activations", None).await;
    assert_eq!(history["total"], 1);
}
#[sqlx::test(migrations = "./migrations")]
async fn insert_failure_rolls_back_decrement(pool: PgPool) {
    // Force the history insert to fail, then verify the transaction restores the balance.
    sqlx::query("ALTER TABLE activations ADD CONSTRAINT fail_insert CHECK (product_id <> 1)")
        .execute(&pool)
        .await
        .unwrap();
    let app = tbm_vouchers::app(pool.clone());
    assert_eq!(
        request(app, "POST", "/api/users/1/activations/1", None)
            .await
            .0,
        StatusCode::INTERNAL_SERVER_ERROR
    );
    assert_eq!(
        sqlx::query_scalar::<_, i32>(
            "SELECT quantity FROM voucher_balances WHERE user_id=1 AND product_id=1"
        )
        .fetch_one(&pool)
        .await
        .unwrap(),
        5
    );
}
#[sqlx::test(migrations = "./migrations")]
async fn history_is_paginated_and_isolated_per_user(pool: PgPool) {
    let app = tbm_vouchers::app(pool);
    for _ in 0..3 {
        request(app.clone(), "POST", "/api/users/1/activations/1", None).await;
    }
    let (_, first) = request(app.clone(), "GET", "/api/users/1/activations?limit=2", None).await;
    let (_, second) = request(
        app.clone(),
        "GET",
        "/api/users/1/activations?limit=2&offset=2",
        None,
    )
    .await;
    assert_eq!(first["total"], 3);
    assert_eq!(first["items"].as_array().unwrap().len(), 2);
    assert_eq!(second["items"].as_array().unwrap().len(), 1);
    assert!(first["items"][1]["id"].as_i64().unwrap() > second["items"][0]["id"].as_i64().unwrap());
    let (_, other) = request(app.clone(), "GET", "/api/users/2/activations", None).await;
    assert_eq!(other["total"], 0);
    for query in ["limit=0", "limit=101", "offset=-1"] {
        assert_eq!(
            request(
                app.clone(),
                "GET",
                &format!("/api/users/1/activations?{query}"),
                None
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
    }
}
