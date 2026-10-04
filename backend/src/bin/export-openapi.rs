use utoipa::OpenApi;
fn main() {
    println!(
        "{}",
        tbm_vouchers::ApiDoc::openapi().to_pretty_json().unwrap()
    );
}
