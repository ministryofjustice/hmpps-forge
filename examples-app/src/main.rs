//! `examples-app` server (server/index.ts + server.ts).

use forge_examples_app::app::{AppPaths, router};

#[tokio::main]
async fn main() {
    // The image has no shell or curl, so container healthchecks run "/app/app healthcheck"
    if std::env::args().nth(1).as_deref() == Some("healthcheck") {
        std::process::exit(healthcheck().await);
    }
    let router = router(AppPaths::from_env(), forge_examples_app::journey::journey());
    topcoat::start(router).await.expect("server");
}

/// Pings the running server, returning 0 if it's up and 1 if not.
async fn healthcheck() -> i32 {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    // Topcoat binds to `PORT` (default 3000); `/ping` is the app's liveness route.
    let port = std::env::var("PORT").or_else(|_| std::env::var("SERVER_PORT")).unwrap_or_else(|_| "3000".to_string());
    let ping = async {
        let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port.parse::<u16>().unwrap_or(3000))).await?;
        let request = format!("GET /ping HTTP/1.1\r\nHost: localhost:{port}\r\nConnection: close\r\n\r\n");
        stream.write_all(request.as_bytes()).await?;
        let mut response = Vec::new();
        stream.read_to_end(&mut response).await?;
        Ok::<_, std::io::Error>(String::from_utf8_lossy(&response).lines().next().unwrap_or_default().to_string())
    };
    match tokio::time::timeout(std::time::Duration::from_secs(5), ping).await {
        Ok(Ok(status)) if status.split_whitespace().nth(1).is_some_and(|code| code.starts_with('2')) => 0,
        Ok(Ok(status)) => {
            eprintln!("{status}");
            1
        }
        Ok(Err(error)) => {
            eprintln!("{error}");
            1
        }
        Err(_) => {
            eprintln!("healthcheck timed out");
            1
        }
    }
}
