FROM rust:1.94-bookworm AS development
RUN rustup component add rustfmt clippy
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
COPY tests ./tests

FROM development AS builder
RUN --mount=type=cache,target=/usr/local/cargo/registry --mount=type=cache,target=/app/target cargo build --release --locked -j 2 && cp target/release/tbm-vouchers /tmp/tbm-vouchers

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /tmp/tbm-vouchers /app/tbm-vouchers
USER 10001:10001
EXPOSE 3000
CMD ["/app/tbm-vouchers"]
