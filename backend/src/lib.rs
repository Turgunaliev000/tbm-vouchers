use axum::{
    Json, Router,
    extract::{Path, Query, State, rejection::JsonRejection},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, put},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use utoipa::{OpenApi, ToSchema};

#[derive(Serialize, FromRow, ToSchema)]
pub struct User {
    pub id: i32,
    pub name: String,
    pub email: String,
}
#[derive(Serialize, FromRow, ToSchema)]
pub struct Product {
    pub id: i32,
    pub name: String,
    pub description: String,
    pub category: String,
}
#[derive(Serialize, FromRow, ToSchema)]
pub struct Balance {
    pub product_id: i32,
    pub quantity: i32,
}
#[derive(Serialize, FromRow, ToSchema)]
pub struct Activation {
    pub id: i32,
    pub product_id: i32,
    pub product_name: String,
    pub activated_at: DateTime<Utc>,
}
#[derive(Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SetBalance {
    #[schema(minimum = 0, maximum = 1000000)]
    pub quantity: i32,
}
#[derive(Serialize, ToSchema)]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
}
#[derive(Serialize, ToSchema)]
pub struct History {
    pub items: Vec<Activation>,
    pub total: i64,
}
#[derive(Deserialize)]
pub struct Pagination {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub struct ApiError(StatusCode, &'static str, &'static str);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.0,
            Json(ErrorBody {
                code: self.1.into(),
                message: self.2.into(),
            }),
        )
            .into_response()
    }
}
impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        tracing::error!(%error, "database operation failed");
        Self(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal_error",
            "Не удалось выполнить операцию. Попробуйте ещё раз.",
        )
    }
}
fn not_found() -> ApiError {
    ApiError(
        StatusCode::NOT_FOUND,
        "not_found",
        "Пользователь или продукт не найден.",
    )
}
async fn require_user(pool: &PgPool, user_id: i32) -> Result<(), ApiError> {
    if !sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE id=$1)")
        .bind(user_id)
        .fetch_one(pool)
        .await?
    {
        return Err(not_found());
    }
    Ok(())
}
async fn require_pair(pool: &PgPool, user_id: i32, product_id: i32) -> Result<(), ApiError> {
    require_user(pool, user_id).await?;
    if !sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM products WHERE id=$1)")
        .bind(product_id)
        .fetch_one(pool)
        .await?
    {
        return Err(not_found());
    }
    Ok(())
}

#[utoipa::path(get, path="/api/users", responses((status=200, body=Vec<User>), (status=500, body=ErrorBody)))]
async fn users(State(pool): State<PgPool>) -> Result<Json<Vec<User>>, ApiError> {
    Ok(Json(
        sqlx::query_as("SELECT id, name, email FROM users ORDER BY id")
            .fetch_all(&pool)
            .await?,
    ))
}
#[utoipa::path(get, path="/api/products", responses((status=200, body=Vec<Product>), (status=500, body=ErrorBody)))]
async fn products(State(pool): State<PgPool>) -> Result<Json<Vec<Product>>, ApiError> {
    Ok(Json(
        sqlx::query_as("SELECT id, name, description, category FROM products ORDER BY id")
            .fetch_all(&pool)
            .await?,
    ))
}
#[utoipa::path(get, path="/api/users/{user_id}/balances", params(("user_id"=i32, Path)), responses((status=200, body=Vec<Balance>), (status=404, body=ErrorBody), (status=500, body=ErrorBody)))]
async fn balances(
    State(pool): State<PgPool>,
    Path(user_id): Path<i32>,
) -> Result<Json<Vec<Balance>>, ApiError> {
    require_user(&pool, user_id).await?;
    Ok(Json(sqlx::query_as("SELECT p.id AS product_id, COALESCE(b.quantity, 0) AS quantity FROM products p LEFT JOIN voucher_balances b ON b.product_id=p.id AND b.user_id=$1 ORDER BY p.id").bind(user_id).fetch_all(&pool).await?))
}
#[utoipa::path(put, path="/api/users/{user_id}/balances/{product_id}", params(("user_id"=i32, Path), ("product_id"=i32, Path)), request_body=SetBalance, responses((status=200, body=Balance), (status=400, body=ErrorBody), (status=404, body=ErrorBody), (status=500, body=ErrorBody)))]
async fn set_balance(
    State(pool): State<PgPool>,
    Path((user_id, product_id)): Path<(i32, i32)>,
    payload: Result<Json<SetBalance>, JsonRejection>,
) -> Result<Json<Balance>, ApiError> {
    let Json(input) = payload.map_err(|_| {
        ApiError(
            StatusCode::BAD_REQUEST,
            "invalid_quantity",
            "Укажите целое число от 0 до 1 000 000.",
        )
    })?;
    if !(0..=1_000_000).contains(&input.quantity) {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "invalid_quantity",
            "Укажите целое число от 0 до 1 000 000.",
        ));
    }
    require_pair(&pool, user_id, product_id).await?;
    Ok(Json(sqlx::query_as("INSERT INTO voucher_balances (user_id, product_id, quantity) VALUES ($1,$2,$3) ON CONFLICT (user_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity RETURNING product_id, quantity").bind(user_id).bind(product_id).bind(input.quantity).fetch_one(&pool).await?))
}
#[utoipa::path(post, path="/api/users/{user_id}/activations/{product_id}", params(("user_id"=i32, Path), ("product_id"=i32, Path)), responses((status=201, body=Activation), (status=404, body=ErrorBody), (status=409, body=ErrorBody), (status=500, body=ErrorBody)))]
async fn activate(
    State(pool): State<PgPool>,
    Path((user_id, product_id)): Path<(i32, i32)>,
) -> Result<(StatusCode, Json<Activation>), ApiError> {
    require_pair(&pool, user_id, product_id).await?;
    let mut tx = pool.begin().await?;
    // UPDATE locks this balance row; PostgreSQL rechecks quantity after waiting for a competing update.
    let changed = sqlx::query("UPDATE voucher_balances SET quantity=quantity-1 WHERE user_id=$1 AND product_id=$2 AND quantity>0").bind(user_id).bind(product_id).execute(&mut *tx).await?.rows_affected();
    if changed == 0 {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "no_vouchers",
            "Ваучеры на этот продукт закончились. Задайте новый запас в форме администратора.",
        ));
    }
    let activation = sqlx::query_as("WITH a AS (INSERT INTO activations (user_id,product_id) VALUES ($1,$2) RETURNING id, product_id, activated_at) SELECT a.*, p.name AS product_name FROM a JOIN products p ON p.id=a.product_id").bind(user_id).bind(product_id).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(activation)))
}
#[utoipa::path(get, path="/api/users/{user_id}/activations", params(("user_id"=i32, Path), ("limit"=Option<i64>, Query, description="1–100, default 20"), ("offset"=Option<i64>, Query, description="Non-negative, default 0")), responses((status=200, body=History), (status=400, body=ErrorBody), (status=404, body=ErrorBody), (status=500, body=ErrorBody)))]
async fn history(
    State(pool): State<PgPool>,
    Path(user_id): Path<i32>,
    Query(page): Query<Pagination>,
) -> Result<Json<History>, ApiError> {
    require_user(&pool, user_id).await?;
    let (limit, offset) = (page.limit.unwrap_or(20), page.offset.unwrap_or(0));
    if !(1..=100).contains(&limit) || offset < 0 {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "invalid_pagination",
            "Некорректные параметры страницы.",
        ));
    }
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        .execute(&mut *tx)
        .await?;
    let total = sqlx::query_scalar("SELECT COUNT(*) FROM activations WHERE user_id=$1")
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;
    let items = sqlx::query_as("SELECT a.id, a.product_id, p.name AS product_name, a.activated_at FROM activations a JOIN products p ON p.id=a.product_id WHERE user_id=$1 ORDER BY a.activated_at DESC, a.id DESC LIMIT $2 OFFSET $3").bind(user_id).bind(limit).bind(offset).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(History { items, total }))
}
async fn health(State(pool): State<PgPool>) -> Result<StatusCode, ApiError> {
    sqlx::query("SELECT 1").execute(&pool).await?;
    Ok(StatusCode::NO_CONTENT)
}
#[derive(OpenApi)]
#[openapi(
    paths(users, products, balances, set_balance, activate, history),
    components(schemas(User, Product, Balance, Activation, SetBalance, ErrorBody, History)),
    info(
        title = "TBM Voucher API",
        version = "1.0.0",
        description = "Demo voucher management. No authentication, as required by the assignment."
    )
)]
pub struct ApiDoc;
pub fn app(pool: PgPool) -> Router {
    Router::new()
        .route("/api/users", get(users))
        .route("/api/products", get(products))
        .route("/api/users/{user_id}/balances", get(balances))
        .route(
            "/api/users/{user_id}/balances/{product_id}",
            put(set_balance),
        )
        .route(
            "/api/users/{user_id}/activations/{product_id}",
            post(activate),
        )
        .route("/api/users/{user_id}/activations", get(history))
        .route("/api/health", get(health))
        .route(
            "/api/openapi.json",
            get(|| async { Json(ApiDoc::openapi()) }),
        )
        .with_state(pool)
}
